import { CombatActionInstance } from './action.js';
import { CombatCommandBuffer, CombatInputFrame } from './combat-input.js';
import { CombatEventLog } from './combat-event-log.js';
import { emitCombatEvent } from './combat-events.js';
import { BladeComboState } from './blade-combo.js';
import { tickDebuffs, createBurnDebuff } from './debuff.js';
import { DriverComboState, getDriverComboDurationFrames } from './driver-combo.js';
import { ActionPhase, ActorState, CombatEventType, DriverComboStage, EnemyState } from './enums.js';
import { EnemyRuntimeState } from './enemy-strike.js';
import { clamp, distance, normalize2 } from './math.js';
import { getRoutineSkillByArtId } from './routine.js';
import { addRoutineTile, canCreateRoutineOrbFromTiles, createRoutineOrbFromTiles } from './routine-orb.js';
import { SpecialGaugeState } from './special-gauge.js';
import { createToken } from './token.js';
import { BladeRuntime } from './blade-runtime.js';
import { resolveLoadout } from './loadout-resolver.js';
import { getItemDefinition } from './backpack-items.js';
import { applyTrustGain, applyMoodChange, computeBondModifiers, DEFAULT_BOND_CONFIG } from './bond.js';

export class CombatActor {
  constructor({
    id = 'Player',
    position = { x: 310, y: 400 },
    target = { id: 'Dummy', x: 660, y: 400, radius: 38, hp: 999999 },
    radius = 24,
    autoAttackRange = 165,
    artRange = 190,
    moveSpeed = 3.2,
    moveDeadZone = 0.1,
    worldBounds = { minX: 40, maxX: 1160, minY: 70, maxY: 730 },
    autoAttackChain,
    arts,
    specials = [],
    specialGaugeInitialCharge = 0,
    bladeComboRoutes = [],
    inputBufferFrames = 10,
    cancelBonusFrames = 15,
    cancelBonusDamageMultiplier = 1.2,
    enemyStrike = null,
    enemyStrikeInitialCooldown = 0,
    backpackGrid = null,
    resolvedLoadout = null,
    eventLog = new CombatEventLog()
  }) {
    if (!autoAttackChain) throw new Error('CombatActor requires autoAttackChain.');
    if (!Array.isArray(arts)) throw new Error('CombatActor requires arts array.');
    if (!Array.isArray(specials)) throw new Error('CombatActor requires specials array.');

    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.radius = radius;
    this.spawnX = this.x;
    this.spawnY = this.y;

    this.target = target;
    if (this.target.maxHp === undefined) this.target.maxHp = this.target.hp;
    if (this.target.dead === undefined) this.target.dead = false;
    this.player = { hp: 999999, maxHp: 999999, dead: false };
    this.battle = { active: true, result: null };
    this.autoAttackRange = autoAttackRange;
    this.artRange = artRange;
    this.moveSpeed = moveSpeed;
    this.moveDeadZone = moveDeadZone;
    this.worldBounds = worldBounds;

    this.autoAttackChain = autoAttackChain;
    this.arts = arts;
    this.specials = specials;
    this.specialGauge = new SpecialGaugeState({
      charge: specialGaugeInitialCharge
    });

    this.state = ActorState.Locomotion;
    this.action = null;
    this.currentArt = null;
    this.currentArtCanceled = false;
    this.currentSpecial = null;
    this.autoAttackIndex = autoAttackChain.firstIndex;

    this.frame = 0;
    this.cancelBonusFrames = cancelBonusFrames;
    this.cancelBonusLeft = 0;
    this.cancelBonusDamageMultiplier = cancelBonusDamageMultiplier;
    this.driverCombo = new DriverComboState();
    this.bladeCombo = new BladeComboState({ routes: bladeComboRoutes });
    this.tokens = [];
    this.routineTiles = [];
    this.routineOrb = null;
    this.debuffs = [];
    this.enemy = new EnemyRuntimeState({
      id: this.target.id,
      targetId: this.id,
      state: EnemyState.Idle,
      strike: enemyStrike,
      cooldownLeft: enemyStrikeInitialCooldown,
      action: null,
    });

    this.eventLog = eventLog;
    this.commandBuffer = new CombatCommandBuffer({
      maxFrames: inputBufferFrames,
      eventLog: this.eventLog,
      getFrame: () => this.frame
    });

    this.config = {
      inputBufferFrames: this.commandBuffer.maxFrames,
      cancelBonusFrames: this.cancelBonusFrames,
      cancelBonusDamageMultiplier: this.cancelBonusDamageMultiplier,
      artMaxCharge: this.arts[0]?.maxCharge ?? 0
    };

    this.vfx = [];
    this.lastEnemyOutcome = null;
    this.paused = false;

    this.backpackGrid = backpackGrid;
    this.resolvedLoadout = resolvedLoadout ?? { activeBlades: [], errors: [] };
    this.bladeRuntimes = [];

    if (this.backpackGrid) {
      const resolved = resolveLoadout({
        backpackGrid: this.backpackGrid,
        socketAssignments: {},
      });
      this.resolvedLoadout = resolved;
      if (resolved.event) {
        this.emit(resolved.event.type, resolved.event.data);
      }
      for (const blade of resolved.activeBlades) {
        this.linkBlade(blade);
      }
    } else if (this.resolvedLoadout?.activeBlades?.length) {
      for (const blade of this.resolvedLoadout.activeBlades) {
        this.linkBlade(blade);
      }
    }

    this.emit(CombatEventType.Init);
    this.emit(CombatEventType.BattleStarted, {
      targetId: this.target.id,
      targetHp: this.target.hp,
      targetMaxHp: this.target.maxHp
    });
  }

  log(type, message, data = {}) {
    return this.eventLog.push(this.frame, type, message, data);
  }

  emit(type, data = {}) {
    return emitCombatEvent(this.eventLog, this.frame, type, data);
  }

  consumeEvents() {
    return this.eventLog.consumeUnread();
  }

  getConfigSnapshot() {
    return { ...this.config };
  }

  applyConfigPatch(patch = {}) {
    if (patch.inputBufferFrames !== undefined) {
      const frames = Number(patch.inputBufferFrames);
      this.setInputBufferFrames(frames);
      this.config.inputBufferFrames = this.commandBuffer.maxFrames;
    }

    if (patch.cancelBonusFrames !== undefined) {
      const frames = Number(patch.cancelBonusFrames);
      this.setCancelBonusFrames(frames);
      this.config.cancelBonusFrames = this.cancelBonusFrames;
    }

    if (patch.artMaxCharge !== undefined) {
      const maxCharge = Number(patch.artMaxCharge);
      this.arts[0]?.setMaxCharge(maxCharge);
      this.config.artMaxCharge = this.arts[0]?.maxCharge ?? 0;
    }

    if (patch.cancelBonusDamageMultiplier !== undefined) {
      const mul = Number(patch.cancelBonusDamageMultiplier);
      this.cancelBonusDamageMultiplier = Number.isFinite(mul) ? mul : this.cancelBonusDamageMultiplier;
      this.config.cancelBonusDamageMultiplier = this.cancelBonusDamageMultiplier;
    }
  }

  getSnapshot() {
    const action = this.action;
    const arts = this.arts;
    const art1 = arts[0] ?? null;
    const art2 = arts[1] ?? null;
    const art3 = arts[2] ?? null;
    const art4 = arts[3] ?? null;
    const cancelRatio = this.cancelBonusFrames ? this.cancelBonusLeft / this.cancelBonusFrames : 0;
    const mapArt = (art) => (art ? ({
      id: art.id,
      charge: art.charge,
      maxCharge: art.maxCharge,
      ready: art.ready,
    }) : null);

    const battle = this.battle ?? { active: true, result: null };
    const player = this.player ?? { hp: 0, maxHp: 0, dead: false };
    const target = this.target ?? { id: 'Dummy', x: 0, y: 0, radius: 0, hp: 0, maxHp: 0, dead: true };
    const enemy = this.enemy ?? null;
    const enemyStrike = enemy?.strike ?? null;
    const enemyAction = enemy?.action ?? null;

    return {
      id: this.id,
      frame: this.frame,
      state: this.state,
      position: { x: this.x, y: this.y },
      radius: this.radius,
      autoAttackRange: this.autoAttackRange,
      artRange: this.artRange,
      inAutoRange: this.inAutoRange(),
      inArtRange: this.inArtRange(),
      action: action ? {
        id: action.spec.id,
        kind: action.spec.kind,
        phase: action.phase,
        elapsedFrames: action.elapsedFrames,
        progress01: action.progress01,
        totalFrames: action.spec.totalFrames,
        startupFrames: action.spec.startupFrames,
        activeFrames: action.spec.activeFrames,
        recoveryFrames: action.spec.recoveryFrames,
      } : null,
      art1: mapArt(art1),
      art2: mapArt(art2),
      art3: mapArt(art3),
      art4: mapArt(art4),
      cancelBonus: {
        frames: this.cancelBonusFrames,
        left: this.cancelBonusLeft,
        ratio: Math.max(0, Math.min(1, cancelRatio)),
        damageMultiplier: this.cancelBonusDamageMultiplier
      },
      inputBuffer: {
        maxFrames: this.commandBuffer.maxFrames,
        slot: this.commandBuffer.peekArtSlot(),
        hasArt: this.commandBuffer.hasArt(),
        ratio: this.commandBuffer.ratio()
      },
      driverCombo: {
        stage: this.driverCombo.stage,
        framesLeft: this.driverCombo.framesLeft,
        duration: getDriverComboDurationFrames(this.driverCombo.stage),
      },
      bladeCombo: {
        stage: this.bladeCombo.stage,
        framesLeft: this.bladeCombo.framesLeft,
        duration: this.bladeCombo.durationFrames,
        routeId: this.bladeCombo.routeId,
        stepIndex: this.bladeCombo.stepIndex,
        expectedNextElement: this.bladeCombo.expectedNext?.element ?? null,
        expectedNextMinLevel: this.bladeCombo.expectedNext?.minLevel ?? null,
      },
      specialGauge: {
        charge: this.specialGauge.charge,
        readyLevel: this.specialGauge.readyLevel,
        ratio: this.specialGauge.ratio,
      },
      tokens: this.tokens.map((t) => ({ ...t })),
      vfx: this.vfx.map((fx) => ({ ...fx })),
      paused: this.paused,
      eventLogText: this.eventLog.toText(),
      config: this.getConfigSnapshot(),
      battle: { ...battle },
      player: { ...player },
      target: { ...target },
      routineTiles: (this.routineTiles ?? []).map((t) => ({ ...t })),
      routineOrb: this.routineOrb ? { ...this.routineOrb } : null,
      debuffs: (this.debuffs ?? []).map((d) => ({ ...d })),
      enemy: enemyStrike ? {
        id: target.id,
        enemyId: target.id,
        hp: target.hp ?? 0,
        maxHp: target.maxHp ?? 0,
        dead: target.dead === true,
        state: target.dead === true ? EnemyState.Dead : (enemy?.state ?? EnemyState.Idle),
        position: { x: target.x, y: target.y },
        targetId: enemy?.targetId ?? this.id,
        cooldownLeft: enemy?.cooldownLeft ?? 0,
        attackSpec: {
          id: enemyStrike.id,
          damage: enemyStrike.damage,
          range: enemyStrike.range,
          cooldownFrames: enemyStrike.cooldownFrames,
          startupFrames: enemyStrike.actionSpec.startupFrames,
          activeFrames: enemyStrike.actionSpec.activeFrames,
          recoveryFrames: enemyStrike.actionSpec.recoveryFrames,
          totalFrames: enemyStrike.actionSpec.totalFrames,
        },
        currentAction: enemyAction ? {
          id: enemyAction.spec.id,
          kind: enemyAction.spec.kind,
          phase: enemyAction.phase,
          elapsedFrames: enemyAction.elapsedFrames,
          progress01: enemyAction.progress01,
          totalFrames: enemyAction.spec.totalFrames,
          startupFrames: enemyAction.spec.startupFrames,
          activeFrames: enemyAction.spec.activeFrames,
          recoveryFrames: enemyAction.spec.recoveryFrames,
        } : null,
        action: enemyAction ? {
          id: enemyAction.spec.id,
          kind: enemyAction.spec.kind,
          phase: enemyAction.phase,
          elapsedFrames: enemyAction.elapsedFrames,
          progress01: enemyAction.progress01,
          totalFrames: enemyAction.spec.totalFrames,
          startupFrames: enemyAction.spec.startupFrames,
          activeFrames: enemyAction.spec.activeFrames,
          recoveryFrames: enemyAction.spec.recoveryFrames,
        } : null,
      } : null,
      lastEnemyOutcome: this.lastEnemyOutcome ? { ...this.lastEnemyOutcome } : null,
      backpack: this.backpackGrid ? this.backpackGrid.getSnapshot() : null,
      resolvedLoadout: this.resolvedLoadout ? {
        activeBlades: (this.resolvedLoadout.activeBlades ?? []).map((b) => ({ ...b })),
        errors: [...(this.resolvedLoadout.errors ?? [])],
        activeLifeSkills: this.resolvedLoadout.activeLifeSkills ? [...this.resolvedLoadout.activeLifeSkills] : [],
      } : null,
      bladeRuntimes: (this.bladeRuntimes ?? []).map((br) => br.getSnapshot()),
    };
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  distToTarget() {
    return distance(this, this.target);
  }

  inAutoRange() {
    return this.distToTarget() <= this.autoAttackRange;
  }

  inArtRange() {
    return this.distToTarget() <= this.artRange;
  }

  currentPhase() {
    return this.action ? this.action.phase : 'None';
  }

  canStartAutoAttack(moveIntent) {
    return !moveIntent && this.inAutoRange() && this.battle?.active !== false && !this.target?.dead && this.state !== ActorState.Dead;
  }

  setInputBufferFrames(frames) {
    this.commandBuffer.setMaxFrames(frames);
  }

  setCancelBonusFrames(frames) {
    this.cancelBonusFrames = Math.max(0, frames | 0);
    this.cancelBonusLeft = Math.min(this.cancelBonusLeft, this.cancelBonusFrames);
  }

  resetRuntime({ keepLog = false } = {}) {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.state = ActorState.Locomotion;
    this.action = null;
    this.currentArt = null;
    this.currentArtCanceled = false;
    this.currentSpecial = null;
    this.autoAttackIndex = this.autoAttackChain.firstIndex;
    this.frame = 0;
    this.cancelBonusLeft = 0;
    this.commandBuffer.clear();
    this.arts.forEach((art) => { art.charge = 0; });
    this.specialGauge.reset();
    this.driverCombo = new DriverComboState();
    this.bladeCombo = new BladeComboState({ routes: this.bladeCombo.routes });
    this.tokens = [];
    this.routineTiles = [];
    this.routineOrb = null;
    this.debuffs = [];
    this.vfx = [];
    this.lastEnemyOutcome = null;
    this.paused = false;
    this.bladeRuntimes = [];
    if (this.resolvedLoadout?.activeBlades?.length) {
      for (const blade of this.resolvedLoadout.activeBlades) {
        this.linkBlade(blade);
      }
    }
    if (this.enemy) {
      this.enemy.reset();
    }
    if (this.player) {
      this.player.hp = this.player.maxHp;
      this.player.dead = false;
    }
    if (this.target) {
      this.target.hp = this.target.maxHp ?? this.target.hp;
      this.target.dead = false;
    }
    if (this.battle) {
      this.battle.active = true;
      this.battle.result = null;
    }

    if (!keepLog) this.eventLog.clear();
    this.emit(CombatEventType.Reset);
    this.emit(CombatEventType.BattleStarted, {
      targetId: this.target.id,
      targetHp: this.target.hp,
      targetMaxHp: this.target.maxHp
    });
  }

  ensureBattleActive() {
    if (!this.battle) this.battle = { active: true, result: null };
    if (!this.player) this.player = { hp: 999999, maxHp: 999999, dead: false };
    if (!this.target) this.target = { id: 'Dummy', x: 0, y: 0, radius: 0, hp: 0, maxHp: 0, dead: true };
  }

  applyDamageToTarget(amount, { source = 'unknown', sourceId = null } = {}) {
    this.ensureBattleActive();
    const dmg = Math.max(0, Number(amount) | 0);
    const before = Number(this.target.hp) | 0;
    if (!this.battle.active || this.target.dead || dmg <= 0) {
      this.emit(CombatEventType.DamageApplied, {
        targetId: this.target.id,
        amount: 0,
        source,
        sourceId,
        beforeHp: before,
        afterHp: before,
      });
      return { before, after: before, applied: 0, defeated: this.target.dead };
    }

    const after = Math.max(0, before - dmg);
    this.emit(CombatEventType.DamageApplied, {
      targetId: this.target.id,
      amount: before - after,
      source,
      sourceId,
      beforeHp: before,
      afterHp: after,
    });

    if (after !== before) {
      this.target.hp = after;
      this.emit(CombatEventType.TargetHpChanged, {
        targetId: this.target.id,
        before,
        after,
        maxHp: this.target.maxHp ?? 0
      });
    }

    if (after <= 0 && !this.target.dead) {
      this.target.dead = true;
      this.emit(CombatEventType.TargetDefeated, { targetId: this.target.id });
      this.battle.active = false;
      this.battle.result = 'Victory';
      this.emit(CombatEventType.BattleEnded, { result: this.battle.result });
      this._applyBondVictory();
    }

    return { before, after, applied: before - after, defeated: this.target.dead };
  }

  applyDamageToPlayer(amount, { source = 'unknown', sourceId = null, enemyId = null } = {}) {
    this.ensureBattleActive();
    const dmg = Math.max(0, Number(amount) | 0);
    const before = Number(this.player.hp) | 0;
    const targetId = this.id;
    if (!this.battle.active || this.player.dead || dmg <= 0) {
      this.emit(CombatEventType.PlayerDamageApplied, {
        targetId,
        amount: 0,
        source,
        sourceId,
        enemyId,
        beforeHp: before,
        afterHp: before,
      });
      this.emit(CombatEventType.DamageApplied, {
        targetId,
        amount: 0,
        source,
        sourceId,
        enemyId,
        beforeHp: before,
        afterHp: before,
      });
      return { before, after: before, applied: 0, defeated: this.player.dead };
    }

    const after = Math.max(0, before - dmg);
    this.emit(CombatEventType.PlayerDamageApplied, {
      targetId,
      amount: before - after,
      source,
      sourceId,
      enemyId,
      beforeHp: before,
      afterHp: after,
    });
    this.emit(CombatEventType.DamageApplied, {
      targetId,
      amount: before - after,
      source,
      sourceId,
      enemyId,
      beforeHp: before,
      afterHp: after,
    });

    if (after !== before) {
      this.player.hp = after;
      this.emit(CombatEventType.PlayerHpChanged, {
        before,
        after,
        maxHp: this.player.maxHp ?? 0
      });
    }

    if (after <= 0 && !this.player.dead) {
      this.player.dead = true;
      this.emit(CombatEventType.PlayerDefeated, {});
      this.battle.active = false;
      this.battle.result = 'Defeat';
      this.emit(CombatEventType.BattleEnded, { result: this.battle.result });
      this._applyBondDefeat();
    }

    return { before, after, applied: before - after, defeated: this.player.dead };
  }

  debugGrantSpecialReady({ level = null, charge = null } = {}) {
    const lv = level === null || level === undefined ? null : Math.max(0, Math.min(3, level | 0));
    const max = this.specialGauge?.threshold3 ?? 300;
    const nextCharge = charge === null || charge === undefined
      ? (lv === 3 ? (this.specialGauge?.threshold3 ?? 300)
        : lv === 2 ? (this.specialGauge?.threshold2 ?? 200)
          : lv === 1 ? (this.specialGauge?.threshold1 ?? 100)
            : 0)
      : (charge | 0);
    const clamped = Math.max(0, Math.min(max | 0, nextCharge | 0));
    this.specialGauge.charge = clamped;
    this.emit(CombatEventType.DebugGrantSpecialReady, { charge: clamped, level: lv });
    return { charge: clamped, level: lv };
  }

  debugGrantEnemyCooldownReady({ tickAfter = false } = {}) {
    if (!this.enemy) return { ok: false, reason: 'no_enemy' };
    this.enemy.cooldownLeft = 0;
    if (this.enemy.action === null && this.enemy.state === EnemyState.Cooldown) {
      this.enemy.state = EnemyState.Idle;
    }
    if (tickAfter) {
      this.tick(new CombatInputFrame());
    }
    return { ok: true, cooldownLeft: this.enemy.cooldownLeft | 0 };
  }

  linkBlade(bladeSpec) {
    const def = getItemDefinition(bladeSpec.bladeId);
    const autoAttackSpec = bladeSpec.autoAttackSpec ?? def?.autoAttack ?? null;

    const runtime = new BladeRuntime({
      resolvedBlade: bladeSpec,
      autoAttackSpec,
    });
    this.bladeRuntimes.push(runtime);
    this.emit(CombatEventType.BladeLinked, {
      bladeId: bladeSpec.bladeId,
      role: bladeSpec.role,
    });
    if (bladeSpec.sockets && bladeSpec.sockets.length > 0) {
      this.emit(CombatEventType.BladeSocketResolved, {
        bladeId: bladeSpec.bladeId,
        element: bladeSpec.element,
      });
    }
    return runtime;
  }

  tickBladeRuntimes() {
    if (!this.bladeRuntimes || this.bladeRuntimes.length === 0) return;
    if (this.battle?.active === false) return;
    if (this.target?.dead) return;

    for (const runtime of this.bladeRuntimes) {
      const result = runtime.tick({ target: this.target, actor: this });
      for (const ev of (result.events ?? [])) {
        this.emit(ev.type, ev.data);
      }
      if (result.damageToApply) {
        this.applyDamageToTarget(result.damageToApply.amount, {
          source: result.damageToApply.source,
          sourceId: result.damageToApply.sourceId,
        });
      }
    }
  }
  _applyBondVictory() {
    if (!this.bladeRuntimes || this.bladeRuntimes.length === 0) return;
    const config = DEFAULT_BOND_CONFIG;
    for (const runtime of this.bladeRuntimes) {
      if (!runtime._participated) continue;
      const modifiers = computeBondModifiers(runtime, config);
      const trustAmount = Math.round(config.trustOnVictory * modifiers.trustMultiplier) + modifiers.extraTrustOnVictory;
      const trustResult = applyTrustGain(runtime.bondState, trustAmount);
      this.emit(CombatEventType.BondTrustChanged, {
        bladeId: runtime.bladeId,
        before: trustResult.before,
        after: trustResult.after,
        beforeLevel: trustResult.beforeLevel,
        afterLevel: trustResult.afterLevel,
      });
      const moodResult = applyMoodChange(runtime.bondState, config.moodOnVictory, 'victory');
      this.emit(CombatEventType.BondMoodChanged, {
        bladeId: runtime.bladeId,
        before: moodResult.before,
        after: moodResult.after,
        reason: moodResult.reason,
      });
    }
  }

  _applyBondDefeat() {
    if (!this.bladeRuntimes || this.bladeRuntimes.length === 0) return;
    const config = DEFAULT_BOND_CONFIG;
    for (const runtime of this.bladeRuntimes) {
      const moodResult = applyMoodChange(runtime.bondState, config.moodOnDefeat, 'defeat');
      this.emit(CombatEventType.BondMoodChanged, {
        bladeId: runtime.bladeId,
        before: moodResult.before,
        after: moodResult.after,
        reason: moodResult.reason,
      });
    }
  }

  breakRoutineOrb() {
    if (!this.routineOrb) {
      this.emit(CombatEventType.RoutineOrbBreakFailed, { reason: 'no_orb' });
      return { ok: false, reason: 'no_orb' };
    }

    const orb = this.routineOrb;
    this.emit(CombatEventType.RoutineOrbBreakStarted, { routineId: orb.routineId, totalLayer: orb.totalLayer });

    const totalLayer = Number(orb.totalLayer) | 0;
    const amount = Math.max(0, totalLayer * 20);
    this.emit(CombatEventType.ElementDamageApplied, { element: 'Fire', amount, totalLayer });
    this.applyDamageToTarget(amount, { source: 'Element', sourceId: 'RoutineOrbBreak' });

    const burn = createBurnDebuff({ appliedFrame: this.frame });
    this.debuffs = [...(this.debuffs ?? []), burn];
    this.emit(CombatEventType.DebuffApplied, { type: burn.type, durationFrames: burn.framesLeft });

    this.emit(CombatEventType.RoutineOrbBroken, { routineId: orb.routineId, totalLayer: orb.totalLayer });
    this.routineOrb = null;
    this.routineTiles = [];
    this.emit(CombatEventType.RoutineOrbBreakFinished, {});
    return { ok: true };
  }

  tick(rawInput = new CombatInputFrame()) {
    const input = rawInput instanceof CombatInputFrame
      ? rawInput
      : new CombatInputFrame(rawInput);

    this.frame += 1;

    if (this.battle?.active === false) {
      this.action = null;
      if (this.enemy) {
        this.enemy.action = null;
        this.enemy.state = EnemyState.Idle;
      }
      this.tickVfx();
      return;
    }

    const debuffResult = tickDebuffs(this.debuffs, 1);
    this.debuffs = debuffResult.debuffs;
    for (const tick of debuffResult.ticks) {
      this.emit(CombatEventType.DebuffTickDamage, { type: tick.type, amount: tick.damage });
      this.applyDamageToTarget(tick.damage, { source: 'Debuff', sourceId: tick.type });
    }
    for (const exp of debuffResult.expired) {
      this.emit(CombatEventType.DebuffExpired, { type: exp.type });
    }
    if (this.battle?.active === false) {
      this.action = null;
      if (this.enemy) {
        this.enemy.action = null;
        this.enemy.state = EnemyState.Idle;
      }
      this.tickVfx();
      return;
    }

    const driverComboEvent = this.driverCombo.tick(1);
    if (driverComboEvent) {
      this.emit(driverComboEvent.type, driverComboEvent.data);
    }
    const bladeComboEvent = this.bladeCombo.tick(1);
    if (bladeComboEvent) {
      this.emit(bladeComboEvent.type, bladeComboEvent.data);
    }
    this.commandBuffer.tick();

    if (this.cancelBonusLeft > 0) {
      this.cancelBonusLeft -= 1;
    }

    for (const slot of input.artSlotsPressed) {
      this.commandBuffer.bufferArt(slot);
    }

    const moveIntent = input.hasMoveIntent(this.moveDeadZone);

    switch (this.state) {
      case ActorState.Art:
        this.tickArtState(input, moveIntent);
        break;
      case ActorState.AutoAttack:
        this.tickAutoAttackState(input, moveIntent);
        break;
      case ActorState.Locomotion:
      default:
        this.tickLocomotionState(input, moveIntent);
        break;
    }

    if (this.battle?.active !== false) {
      this.tickEnemy();
      this.tickBladeRuntimes();
    }

    this.tickVfx();
  }

  inEnemyStrikeRange() {
    const strike = this.enemy?.strike ?? null;
    if (!strike) return false;
    return this.distToTarget() <= strike.range;
  }

  tickEnemy() {
    const enemy = this.enemy;
    const strike = enemy?.strike ?? null;
    if (!enemy || !strike) return;

    enemy.id = String(this.target?.id ?? enemy.id ?? 'Enemy');
    enemy.enemyId = enemy.id;

    if (this.target?.dead) {
      enemy.state = EnemyState.Dead;
      enemy.action = null;
      return;
    }

    if (this.player?.dead || this.battle?.active === false) {
      enemy.action = null;
      return;
    }

    if (enemy.targetSelectedEmitted !== true || enemy.targetId !== this.id) {
      enemy.targetId = this.id;
      enemy.targetSelectedEmitted = true;
      this.emit(CombatEventType.EnemyTargetSelected, { enemyId: enemy.id, targetId: enemy.targetId });
    }

    const beforeCooldown = enemy.cooldownLeft;
    if (enemy.cooldownLeft > 0) {
      enemy.cooldownLeft -= 1;
      if (beforeCooldown > 0 && enemy.cooldownLeft === 0) {
        this.emit(CombatEventType.EnemyAttackCooldownFinished, { attackId: strike.id, enemyId: enemy.id });
      }
    }

    const stage = this.driverCombo?.stage ?? DriverComboStage.None;
    const controlled = stage === DriverComboStage.Topple || stage === DriverComboStage.Launch;
    if (controlled) {
      if (enemy.state !== EnemyState.Controlled) {
        this.emit(CombatEventType.EnemyControlled, { enemyId: enemy.id, stage, framesLeft: this.driverCombo?.framesLeft ?? 0 });
      }
      enemy.state = EnemyState.Controlled;

      if (enemy.action) {
        const phase = enemy.action.phase;
        if (phase === ActionPhase.Startup || phase === ActionPhase.Active) {
          this.emit(CombatEventType.EnemyAttackInterrupted, { attackId: strike.id, reason: 'driver_combo', stage, enemyId: enemy.id });
          enemy.action = null;
          const before = enemy.cooldownLeft;
          enemy.cooldownLeft = Math.max(enemy.cooldownLeft, strike.cooldownFrames);
          if (before <= 0 && enemy.cooldownLeft > 0) {
            this.emit(CombatEventType.EnemyAttackCooldownStarted, { attackId: strike.id, enemyId: enemy.id, frames: enemy.cooldownLeft });
          }
          return;
        }

        const before = enemy.action.phase;
        enemy.action.tick(1);
        const after = enemy.action.phase;
        if (before !== after) {
          this.emit(CombatEventType.EnemyAttackPhaseChanged, { attackId: strike.id, before, after, enemyId: enemy.id });
        }

        if (enemy.action.isFinished()) {
          this.emit(CombatEventType.EnemyAttackFinished, { attackId: strike.id, enemyId: enemy.id });
          enemy.action = null;
          enemy.cooldownLeft = strike.cooldownFrames;
          if (enemy.cooldownLeft > 0) {
            this.emit(CombatEventType.EnemyAttackCooldownStarted, { attackId: strike.id, enemyId: enemy.id, frames: enemy.cooldownLeft });
          }
        }
      }

      return;
    }

    if (enemy.action) {
      enemy.state = EnemyState.Attacking;
      const before = enemy.action.phase;
      enemy.action.tick(1);
      const after = enemy.action.phase;
      if (before !== after) {
        this.emit(CombatEventType.EnemyAttackPhaseChanged, { attackId: strike.id, before, after, enemyId: enemy.id });
      }

      if (enemy.action.shouldFireHit()) {
        if (!this.inEnemyStrikeRange()) {
          this.emit(CombatEventType.EnemyAttackWhiffed, { attackId: strike.id, reason: 'out_of_range', enemyId: enemy.id });
          this.lastEnemyOutcome = { kind: 'miss', frame: this.frame };
        } else {
          const damage = strike.damage ?? strike.actionSpec.damage ?? 0;
          this.emit(CombatEventType.EnemyAttackHit, { attackId: strike.id, damage, enemyId: enemy.id, targetId: this.id });
          this.lastEnemyOutcome = { kind: 'hit', frame: this.frame };
          this.applyDamageToPlayer(damage, { source: 'EnemyStrike', sourceId: strike.id, enemyId: enemy.id });
        }
      }

      if (enemy.action.isFinished()) {
        this.emit(CombatEventType.EnemyAttackFinished, { attackId: strike.id, enemyId: enemy.id });
        enemy.action = null;
        enemy.cooldownLeft = strike.cooldownFrames;
        if (enemy.cooldownLeft > 0) {
          this.emit(CombatEventType.EnemyAttackCooldownStarted, { attackId: strike.id, enemyId: enemy.id, frames: enemy.cooldownLeft });
          enemy.state = EnemyState.Cooldown;
        } else {
          enemy.state = EnemyState.Idle;
        }
      }
      return;
    }

    if (enemy.cooldownLeft > 0) {
      enemy.state = EnemyState.Cooldown;
      return;
    }

    if (this.inEnemyStrikeRange()) {
      enemy.action = new CombatActionInstance(strike.actionSpec);
      enemy.state = EnemyState.Attacking;
      this.emit(CombatEventType.EnemyAttackStarted, { attackId: strike.id, enemyId: enemy.id, targetId: enemy.targetId });
      return;
    }

    enemy.state = EnemyState.Idle;
  }

  tickLocomotionState(input, moveIntent) {
    this.applyMovement(input, moveIntent);

    if (this.tryUseBufferedReadyArt({ requireAutoRecoveryCancel: false })) {
      return;
    }

    if (this.canStartAutoAttack(moveIntent)) {
      this.startAutoAttack();
    }
  }

  tickAutoAttackState(input, moveIntent) {
    this.tickCurrentAction();

    if (this.action?.shouldFireHit()) {
      this.onAutoAttackHit(this.action.spec);
    }

    if (this.action?.spec.canCancelToArt(this.action.elapsedFrames)) {
      if (this.tryUseBufferedReadyArt({ requireAutoRecoveryCancel: true })) {
        return;
      }
    }

    if (this.action?.spec.canCancelToMovement(this.action.elapsedFrames) && moveIntent) {
      this.emit(CombatEventType.RecoveryCanceledToMovement, { actionId: this.action.spec.id });
      this.action = null;
      this.cancelBonusLeft = 0;
      this.resetAutoAttackChain();
      this.state = ActorState.Locomotion;
      this.applyMovement(input, moveIntent);
      return;
    }

    if (this.action?.isFinished()) {
      const finishedSpec = this.action.spec;
      this.emit(CombatEventType.ActionFinished, { actionId: finishedSpec.id });
      this.action = null;
      this.advanceAutoAttackChain();

      if (this.canStartAutoAttack(moveIntent)) {
        this.startAutoAttack();
      } else {
        this.resetAutoAttackChain();
        this.state = ActorState.Locomotion;
      }
    }
  }

  tickArtState(input, moveIntent) {
    this.tickCurrentAction();

    if (this.action?.shouldFireHit()) {
      if (this.currentArt) {
        this.onArtHit(this.currentArt, this.currentArtCanceled);
      } else if (this.currentSpecial) {
        this.onSpecialHit(this.currentSpecial);
      }
    }

    if (this.action?.isFinished()) {
      if (this.currentArt) {
        this.emit(CombatEventType.ActionFinished, { artId: this.currentArt.id });
      } else if (this.currentSpecial) {
        this.emit(CombatEventType.ActionFinished, { actionId: this.action.spec.id });
      }

      this.action = null;
      this.currentArt = null;
      this.currentArtCanceled = false;
      this.currentSpecial = null;
      this.resetAutoAttackChain();

      if (this.canStartAutoAttack(moveIntent)) {
        this.startAutoAttack();
      } else {
        this.state = ActorState.Locomotion;
      }
    }
  }

  tickCurrentAction() {
    if (!this.action) return;

    const before = this.action.phase;
    this.action.tick();
    const after = this.action.phase;

    if (before !== after) {
      this.emit(CombatEventType.ActionPhaseChanged, { actionId: this.action.spec.id, before, after });
    }
  }

  applyMovement(input, moveIntent) {
    if (!moveIntent) return;

    const n = normalize2(input.moveX, input.moveY);
    this.x += n.x * this.moveSpeed;
    this.y += n.y * this.moveSpeed;
    this.x = clamp(this.x, this.worldBounds.minX, this.worldBounds.maxX);
    this.y = clamp(this.y, this.worldBounds.minY, this.worldBounds.maxY);
  }

  startAutoAttack() {
    const spec = this.autoAttackChain.getStage(this.autoAttackIndex);
    this.action = new CombatActionInstance(spec);
    this.state = ActorState.AutoAttack;
    this.emit(CombatEventType.ActionStarted, { actionId: spec.id });
  }

  startArt(art, canceled) {
    this.action = new CombatActionInstance(art.actionSpec);
    this.state = ActorState.Art;
    this.currentArt = art;
    this.currentArtCanceled = canceled;
    art.consume();

    this.emit(CombatEventType.ArtConsumed, { artId: art.id });
    this.emit(CombatEventType.ActionStarted, { artId: art.id, canceled });
  }

  castSpecial(slotOrId = 0) {
    const special = typeof slotOrId === 'string'
      ? (this.specials.find((s) => s?.id === slotOrId) ?? null)
      : (this.specials[slotOrId] ?? null);
    if (!special) {
      const specialId = typeof slotOrId === 'string' ? slotOrId : `Special${(slotOrId | 0) + 1}`;
      this.emit(CombatEventType.SpecialCastFailed, { specialId, reason: 'unknown_special' });
      return false;
    }

    if (this.state !== ActorState.Locomotion) {
      this.emit(CombatEventType.SpecialCastFailed, { specialId: special.id, reason: 'busy' });
      return false;
    }

    if (!this.inArtRange()) {
      this.emit(CombatEventType.SpecialCastFailed, { specialId: special.id, reason: 'out_of_range' });
      return false;
    }

    const consumed = this.specialGauge.tryConsumeLevel(special.level);
    if (!consumed.ok) {
      this.emit(CombatEventType.SpecialCastFailed, { specialId: special.id, reason: 'insufficient_level' });
      return false;
    }

    this.emit(CombatEventType.SpecialConsumed, {
      specialId: special.id,
      level: consumed.level,
      cost: consumed.cost,
      beforeCharge: consumed.beforeCharge,
      afterCharge: consumed.afterCharge
    });

    this.action = new CombatActionInstance(special.actionSpec);
    this.state = ActorState.Art;
    this.currentArt = null;
    this.currentArtCanceled = false;
    this.currentSpecial = special;
    this.resetAutoAttackChain();
    this.emit(CombatEventType.ActionStarted, { actionId: special.actionSpec.id });
    return true;
  }

  tryUseBufferedReadyArt({ requireAutoRecoveryCancel }) {
    if (!this.commandBuffer.hasArt()) return false;

    const slot = this.commandBuffer.peekArtSlot();
    const art = this.arts[slot];
    if (!art || !art.ready || !this.inArtRange()) return false;

    let canceled = false;

    if (this.state === ActorState.AutoAttack && this.action) {
      if (!this.action.spec.canCancelToArt(this.action.elapsedFrames)) {
        return false;
      }

      canceled = this.cancelBonusLeft > 0;

      this.emit(CombatEventType.RecoveryCanceledToArt, { fromActionId: this.action.spec.id, artId: art.id });
    } else if (requireAutoRecoveryCancel) {
      return false;
    }

    this.commandBuffer.consumeArt();

    if (canceled) {
      this.emit(CombatEventType.CancelBonusApplied, { artId: art.id });
    }

    this.startArt(art, canceled);
    return true;
  }

  onAutoAttackHit(spec) {
    if (!this.inAutoRange()) {
      this.emit(CombatEventType.ActionWhiffed, { actionId: spec.id });
      return;
    }

    this.emit(CombatEventType.ActionHit, { actionId: spec.id, damage: spec.damage });
    this.applyDamageToTarget(spec.damage, { source: 'AutoAttack', sourceId: spec.id });
    this.spawnDamageNumber(spec.damage, 'hit');

    for (const art of this.arts) {
      const result = art.addCharge(spec.artChargeGain);
      if (result.before !== result.after) {
        this.emit(CombatEventType.ArtChargeChanged, { artId: art.id, before: result.before, after: result.after });
      }

      if (result.becameReady) {
        this.emit(CombatEventType.ArtBecameReady, { artId: art.id });
      }
    }

    this.cancelBonusLeft = this.cancelBonusFrames;
    this.emit(CombatEventType.CancelBonusWindowOpened, { frames: this.cancelBonusFrames });
  }

  onArtHit(art, canceled) {
    if (!this.inArtRange()) {
      this.emit(CombatEventType.ActionWhiffed, { artId: art.id });
      return;
    }

    const routineSkill = getRoutineSkillByArtId(art.id);
    const damage = Math.round(art.actionSpec.damage * (canceled ? this.cancelBonusDamageMultiplier : 1));
    this.emit(CombatEventType.ActionHit, { artId: art.id, damage, canceled });
    this.applyDamageToTarget(damage, { source: 'Art', sourceId: art.id });
    this.spawnDamageNumber(damage, canceled ? 'cancel-art' : 'art');

    if (routineSkill) {
      const beforeCount = (this.routineTiles ?? []).length;
      const tile = {
        routineId: routineSkill.routineId,
        skillId: routineSkill.skillId,
        layer: routineSkill.layer,
        createdFrame: this.frame,
      };
      const added = addRoutineTile(this.routineTiles, tile, { maxTiles: 3 });
      this.routineTiles = added.tiles;
      this.emit(CombatEventType.RoutineTileAdded, {
        routineId: tile.routineId,
        skillId: tile.skillId,
        layer: tile.layer,
        tilesCount: this.routineTiles.length,
        beforeTilesCount: beforeCount,
      });
      for (const r of added.removed) {
        this.emit(CombatEventType.RoutineTileRemoved, {
          routineId: r.routineId,
          skillId: r.skillId,
          layer: r.layer,
          tilesCount: this.routineTiles.length,
        });
      }

      if (canCreateRoutineOrbFromTiles(this.routineTiles)) {
        const nextOrb = createRoutineOrbFromTiles(this.routineTiles, { createdFrame: this.frame });
        if (this.routineOrb) {
          this.emit(CombatEventType.RoutineOrbReplaced, {
            routineId: nextOrb.routineId,
            totalLayer: nextOrb.totalLayer,
            beforeRoutineId: this.routineOrb.routineId,
            beforeTotalLayer: this.routineOrb.totalLayer,
          });
        } else {
          this.emit(CombatEventType.RoutineOrbCreated, {
            routineId: nextOrb.routineId,
            totalLayer: nextOrb.totalLayer,
          });
        }
        this.routineOrb = nextOrb;
      }
    }

    const specialGain = art.specialChargeGain ?? 0;
    if (specialGain > 0) {
      const result = this.specialGauge.addCharge(specialGain);
      if (result.beforeCharge !== result.afterCharge) {
        this.emit(CombatEventType.SpecialChargeChanged, {
          beforeCharge: result.beforeCharge,
          afterCharge: result.afterCharge,
          beforeReadyLevel: result.beforeReadyLevel,
          afterReadyLevel: result.afterReadyLevel,
          artId: art.id
        });
      }
      if (result.becameReady) {
        this.emit(CombatEventType.SpecialBecameReady, {
          readyLevel: result.afterReadyLevel,
          charge: result.afterCharge,
          artId: art.id
        });
      }
    }

    if (art.effect !== null && art.effect !== undefined) {
      const driverComboEvent = this.driverCombo.apply(art.effect);
      if (driverComboEvent) {
        this.emit(driverComboEvent.type, driverComboEvent.data);
        if (driverComboEvent.type === CombatEventType.DriverComboFinished && driverComboEvent.data?.effect === 'Smash') {
          this.spawnDamageNumber('SMASH!', 'smash');
        }
      }
    }
  }

  onSpecialHit(special) {
    if (!this.inArtRange()) {
      this.emit(CombatEventType.ActionWhiffed, { actionId: special.actionSpec.id });
      return;
    }

    const damage = special.damage ?? special.actionSpec.damage ?? 0;
    this.emit(CombatEventType.SpecialHit, { specialId: special.id, element: special.element ?? null, level: special.level, damage });
    this.emit(CombatEventType.ActionHit, { actionId: special.actionSpec.id, damage });
    this.applyDamageToTarget(damage, { source: 'Special', sourceId: special.id });
    this.spawnDamageNumber(damage, 'special');

    if (special.element) {
      const result = this.bladeCombo.apply({ element: special.element, level: special.level });
      for (const ev of result.events ?? []) {
        this.emit(ev.type, ev.data);
      }
      if (result.token) {
        const token = this.createTokenFromSpec(result.token);
        this.emit(CombatEventType.TokenCreated, token);
      }
    }
  }

  createTokenFromSpec({ id, element = null, sourceRouteId = null } = {}) {
    const token = createToken({ id, element, sourceRouteId, createdFrame: this.frame });
    this.tokens.push(token);
    return token;
  }

  resetAutoAttackChain() {
    if (this.autoAttackIndex !== this.autoAttackChain.firstIndex) {
      this.emit(CombatEventType.AutoAttackChainReset);
    }

    this.autoAttackIndex = this.autoAttackChain.firstIndex;
  }

  advanceAutoAttackChain() {
    this.autoAttackIndex = this.autoAttackChain.getNextIndex(this.autoAttackIndex);
    this.emit(CombatEventType.AutoAttackChainAdvanced, { nextActionId: this.autoAttackChain.getStage(this.autoAttackIndex).id });
  }

  spawnDamageNumber(text, kind) {
    const life = kind === 'hit' ? 16 : kind === 'smash' ? 34 : 22;
    const yOffset = kind === 'hit' ? 0 : kind === 'smash' ? -44 : -18;
    this.vfx.push({
      x: this.target.x,
      y: this.target.y + yOffset,
      life,
      text: String(text),
      kind
    });
  }

  tickVfx() {
    for (const fx of this.vfx) {
      fx.life -= 1;
      fx.y -= 0.55;
    }

    this.vfx = this.vfx.filter((fx) => fx.life > 0);
  }
}
