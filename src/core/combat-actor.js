import { CombatActionInstance } from './action.js';
import { CombatCommandBuffer, CombatInputFrame } from './combat-input.js';
import { CombatEventLog } from './combat-event-log.js';
import { emitCombatEvent } from './combat-events.js';
import { BladeComboState } from './blade-combo.js';
import { DriverComboState, getDriverComboDurationFrames } from './driver-combo.js';
import { ActorState, CombatEventType } from './enums.js';
import { clamp, distance, normalize2 } from './math.js';
import { SpecialGaugeState } from './special-gauge.js';
import { createToken } from './token.js';

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
    this.paused = false;

    this.emit(CombatEventType.Init);
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

    return {
      id: this.id,
      frame: this.frame,
      state: this.state,
      position: { x: this.x, y: this.y },
      radius: this.radius,
      target: { ...this.target },
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
      config: this.getConfigSnapshot()
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
    return !moveIntent && this.inAutoRange() && this.state !== ActorState.Dead;
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
    this.vfx = [];
    this.paused = false;

    if (!keepLog) this.eventLog.clear();
    this.emit(CombatEventType.Reset);
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

  tick(rawInput = new CombatInputFrame()) {
    const input = rawInput instanceof CombatInputFrame
      ? rawInput
      : new CombatInputFrame(rawInput);

    this.frame += 1;
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

    this.tickVfx();
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

    const damage = Math.round(art.actionSpec.damage * (canceled ? this.cancelBonusDamageMultiplier : 1));
    this.emit(CombatEventType.ActionHit, { artId: art.id, damage, canceled });
    this.spawnDamageNumber(damage, canceled ? 'cancel-art' : 'art');

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
