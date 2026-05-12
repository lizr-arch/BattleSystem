import { CombatInputFrame } from '../core/combat-input.js';
import { ActionPhase, ActorState, CombatEventType } from '../core/enums.js';
import { runScenario as runScenarioCore } from '../dev/scenario-runner.js';
import { getScenario } from '../dev/scenarios.js';

export class DebugPanel {
  constructor({ documentObject = document, actor }) {
    this.document = documentObject;
    this.actor = actor;
    this.refs = {
      frame: this.byId('frame'),
      state: this.byId('state'),
      action: this.byId('action'),
      phase: this.byId('phase'),
      actionBar: this.byId('actionBar'),
      chargeBar: this.byId('chargeBar'),
      cancelBar: this.byId('cancelBar'),
      bufferBar: this.byId('bufferBar'),
      art1Info: this.byId('art1Info'),
      art2Info: this.byId('art2Info'),
      art3Info: this.byId('art3Info'),
      art4Info: this.byId('art4Info'),
      spBar: this.byId('spBar'),
      spInfo: this.byId('spInfo'),
      log: this.byId('log'),
      buffer: this.byId('buffer'),
      cancel: this.byId('cancel'),
      maxCharge: this.byId('maxCharge'),
      bufferV: this.byId('bufferV'),
      cancelV: this.byId('cancelV'),
      chargeV: this.byId('chargeV'),
      pause: this.byId('pause'),
      step: this.byId('step'),
      reset: this.byId('reset'),
      clear: this.byId('clear'),
      blsArts: this.byId('blsArts'),
      blsDriver: this.byId('blsDriver'),
      blsSpecial: this.byId('blsSpecial'),
      blsBlade: this.byId('blsBlade'),
      blsTokens: this.byId('blsTokens'),
      blsTokensList: this.byId('blsTokensList'),
      blsLastEvent: this.byId('blsLastEvent'),
      dcStage: this.byId('dcStage'),
      dcBar: this.byId('dcBar'),
      dcFramesLeft: this.byId('dcFramesLeft'),
      dcDuration: this.byId('dcDuration'),
      dcLastEvent: this.byId('dcLastEvent'),
      bcStage: this.byId('bcStage'),
      bcBar: this.byId('bcBar'),
      bcFramesLeft: this.byId('bcFramesLeft'),
      bcDuration: this.byId('bcDuration'),
      bcRouteId: this.byId('bcRouteId'),
      bcExpected: this.byId('bcExpected'),
      tokensList: this.byId('tokensList'),
      mvpBattle: this.byId('mvpBattle'),
      mvpTargetHpText: this.byId('mvpTargetHpText'),
      mvpTargetHpBar: this.byId('mvpTargetHpBar'),
      mvpTiles: this.byId('mvpTiles'),
      mvpOrb: this.byId('mvpOrb'),
      mvpBurn: this.byId('mvpBurn'),
      mvpLastEvent: this.byId('mvpLastEvent'),
      mvpRunScenario: this.byId('mvpRunScenario'),
      mvpGrantTiles: this.byId('mvpGrantTiles'),
      mvpCastSkill1: this.byId('mvpCastSkill1'),
      mvpCastSkill2: this.byId('mvpCastSkill2'),
      mvpCastSkill3: this.byId('mvpCastSkill3'),
      mvpBreakOrb: this.byId('mvpBreakOrb'),
      epEnemyState: this.byId('epEnemyState'),
      epEnemyAction: this.byId('epEnemyAction'),
      epEnemyPhase: this.byId('epEnemyPhase'),
      epEnemyCooldown: this.byId('epEnemyCooldown'),
      epEnemyHp: this.byId('epEnemyHp'),
      epPlayerHp: this.byId('epPlayerHp'),
      epBattleResult: this.byId('epBattleResult'),
      epLastEnemyEvent: this.byId('epLastEnemyEvent'),
      epRunEnemyHit: this.byId('epRunEnemyHit'),
      epRunEnemyWhiff: this.byId('epRunEnemyWhiff'),
      epRunPlayerDefeat: this.byId('epRunPlayerDefeat'),
      epGrantEnemyCooldownReady: this.byId('epGrantEnemyCooldownReady'),
      scFullBattleLoop: this.byId('scFullBattleLoop'),
      scFull: this.byId('scFull'),
      scWrong: this.byId('scWrong'),
      scExpireBreak: this.byId('scExpireBreak'),
      scExpireTopple: this.byId('scExpireTopple'),
      scBladeFull: this.byId('scBladeFull'),
      scBladeFailWaterFirst: this.byId('scBladeFailWaterFirst'),
      scBladeWrongElement: this.byId('scBladeWrongElement'),
      scBladeInsufficientLevel: this.byId('scBladeInsufficientLevel'),
      scBladeExpire: this.byId('scBladeExpire'),
      scDriverBladeCoexist: this.byId('scDriverBladeCoexist'),
      scEnemyStart: this.byId('scEnemyStart'),
      scEnemyHit: this.byId('scEnemyHit'),
      scEnemyWhiff: this.byId('scEnemyWhiff'),
      scEnemyCooldown: this.byId('scEnemyCooldown'),
      scEnemyToppled: this.byId('scEnemyToppled'),
      scEnemyDefeat: this.byId('scEnemyDefeat'),
      scEnemyKilled: this.byId('scEnemyKilled'),
      scResult: this.byId('scResult'),
      scProof: this.byId('scProof'),
      dbgGrantReady: this.byId('dbgGrantReady'),
      dbgGrantSp1: this.byId('dbgGrantSp1'),
      dbgGrantSp2: this.byId('dbgGrantSp2'),
      dbgGrantSp3: this.byId('dbgGrantSp3'),
      dbgCastSpFire1: this.byId('dbgCastSpFire1'),
      dbgCastSpWater2: this.byId('dbgCastSpWater2'),
      dbgCastSpFire3: this.byId('dbgCastSpFire3'),
      dbgStepToRecovery: this.byId('dbgStepToRecovery'),
      dbgCast1: this.byId('dbgCast1'),
      dbgCast2: this.byId('dbgCast2'),
      dbgCast3: this.byId('dbgCast3'),
      dbgCast4: this.byId('dbgCast4'),
    };
  }

  byId(id) {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing debug panel element #${id}`);
    return element;
  }

  bindControls({
    onPause,
    onStep,
    onReset,
    onClear,
    onMvpRunScenario,
    onMvpGrantTiles,
    onMvpCastSkill1,
    onMvpCastSkill2,
    onMvpCastSkill3,
    onMvpBreakOrb,
  }) {
    this.refs.pause.addEventListener('click', onPause);
    this.refs.step.addEventListener('click', onStep);
    this.refs.reset.addEventListener('click', onReset);
    this.refs.clear.addEventListener('click', onClear);

    const sync = () => this.applyTuning();
    this.refs.buffer.addEventListener('input', sync);
    this.refs.cancel.addEventListener('input', sync);
    this.refs.maxCharge.addEventListener('input', sync);
    this.applyTuning();

    this.refs.scFullBattleLoop.addEventListener('click', () => this.runScenario('full-battle-loop'));
    this.refs.scFull.addEventListener('click', () => this.runScenario('full-driver-combo'));
    this.refs.scWrong.addEventListener('click', () => this.runScenario('wrong-order-smash'));
    this.refs.scExpireBreak.addEventListener('click', () => this.runScenario('expire-break'));
    this.refs.scExpireTopple.addEventListener('click', () => this.runScenario('expire-topple'));
    this.refs.scBladeFull.addEventListener('click', () => this.runScenario('full-blade-combo'));
    this.refs.scBladeFailWaterFirst.addEventListener('click', () => this.runScenario('blade-combo-fail-water-first'));
    this.refs.scBladeWrongElement.addEventListener('click', () => this.runScenario('wrong-element-blade-combo'));
    this.refs.scBladeInsufficientLevel.addEventListener('click', () => this.runScenario('insufficient-level-blade-combo'));
    this.refs.scBladeExpire.addEventListener('click', () => this.runScenario('expire-blade-combo'));
    this.refs.scDriverBladeCoexist.addEventListener('click', () => this.runScenario('driver-and-blade-coexist'));
    this.refs.scEnemyStart.addEventListener('click', () => this.runScenario('enemy-starts-attack-when-player-in-range'));
    this.refs.scEnemyHit.addEventListener('click', () => this.runScenario('enemy-attack-hits-player'));
    this.refs.scEnemyWhiff.addEventListener('click', () => this.runScenario('enemy-attack-whiffs-when-player-out-of-range'));
    this.refs.scEnemyCooldown.addEventListener('click', () => this.runScenario('enemy-attack-enters-cooldown'));
    this.refs.scEnemyToppled.addEventListener('click', () => this.runScenario('enemy-cannot-attack-while-toppled'));
    this.refs.scEnemyDefeat.addEventListener('click', () => this.runScenario('enemy-can-defeat-player'));
    this.refs.scEnemyKilled.addEventListener('click', () => this.runScenario('player-can-defeat-attacking-enemy'));

    this.refs.epRunEnemyHit.addEventListener('click', () => this.runScenario('enemy-attack-hits-player'));
    this.refs.epRunEnemyWhiff.addEventListener('click', () => this.runScenario('enemy-attack-whiffs-when-player-out-of-range'));
    this.refs.epRunPlayerDefeat.addEventListener('click', () => this.runScenario('enemy-can-defeat-player'));
    this.refs.epGrantEnemyCooldownReady.addEventListener('click', () => this.grantEnemyCooldownReady());

    this.refs.dbgGrantReady.addEventListener('click', () => this.grantAllArtsReady());
    this.refs.dbgGrantSp1.addEventListener('click', () => this.grantSpecialLevel(1));
    this.refs.dbgGrantSp2.addEventListener('click', () => this.grantSpecialLevel(2));
    this.refs.dbgGrantSp3.addEventListener('click', () => this.grantSpecialLevel(3));
    this.refs.dbgCastSpFire1.addEventListener('click', () => this.castSpecial('FireLv1'));
    this.refs.dbgCastSpWater2.addEventListener('click', () => this.castSpecial('WaterLv2'));
    this.refs.dbgCastSpFire3.addEventListener('click', () => this.castSpecial('FireLv3'));
    this.refs.dbgStepToRecovery.addEventListener('click', () => this.stepToRecovery());
    this.refs.dbgCast1.addEventListener('click', () => this.castArt(0));
    this.refs.dbgCast2.addEventListener('click', () => this.castArt(1));
    this.refs.dbgCast3.addEventListener('click', () => this.castArt(2));
    this.refs.dbgCast4.addEventListener('click', () => this.castArt(3));

    if (onMvpRunScenario) this.refs.mvpRunScenario.addEventListener('click', onMvpRunScenario);
    if (onMvpGrantTiles) this.refs.mvpGrantTiles.addEventListener('click', onMvpGrantTiles);
    if (onMvpCastSkill1) this.refs.mvpCastSkill1.addEventListener('click', onMvpCastSkill1);
    if (onMvpCastSkill2) this.refs.mvpCastSkill2.addEventListener('click', onMvpCastSkill2);
    if (onMvpCastSkill3) this.refs.mvpCastSkill3.addEventListener('click', onMvpCastSkill3);
    if (onMvpBreakOrb) this.refs.mvpBreakOrb.addEventListener('click', onMvpBreakOrb);
  }

  applyTuning() {
    const inputBufferFrames = Number(this.refs.buffer.value);
    const cancelBonusFrames = Number(this.refs.cancel.value);
    const maxCharge = Number(this.refs.maxCharge.value);

    this.actor.applyConfigPatch({
      inputBufferFrames,
      cancelBonusFrames,
      artMaxCharge: maxCharge
    });

    this.refs.bufferV.textContent = String(inputBufferFrames);
    this.refs.cancelV.textContent = String(cancelBonusFrames);
    this.refs.chargeV.textContent = String(maxCharge);
  }

  setScenarioResult(result) {
    this.refs.scResult.textContent = result?.passed ? 'PASS' : 'FAIL';
    this.refs.scProof.textContent = this.formatScenarioProof(result);
  }

  formatScenarioProof(result) {
    if (!result) return '';
    if (result.passed) {
      return result.proof.map((p) => `[${p.frame}] ${p.label}`).join('\n');
    }

    const lines = [];
    lines.push(`FAILED: ${result.failedStep?.label ?? 'Unknown'}`);
    for (const p of result.proof) {
      lines.push(`[${p.frame}] ${p.ok ? 'OK ' : 'ERR'} ${p.label}`);
    }
    lines.push('');
    lines.push('TRACE TAIL:');
    const tail = (result.trace ?? []).slice(Math.max(0, (result.trace ?? []).length - 30));
    for (const r of tail) {
      const action = r.action ? `${r.action.id}/${r.action.phase}` : 'None';
      const dc = `${r.driverCombo?.stage ?? 'None'} ${r.driverCombo?.framesLeft ?? 0}/${r.driverCombo?.duration ?? 0}`;
      const ev = (r.eventsThisFrame ?? []).map((e) => e.message || e.type).join(' | ');
      lines.push(`${String(r.frame).padStart(5, ' ')} ${r.state} ${action} dc=${dc}${ev ? ` :: ${ev}` : ''}`);
    }
    return lines.join('\n');
  }

  findLastEventLine(eventLogText, accept) {
    const text = typeof eventLogText === 'string' ? eventLogText : '';
    if (!text) return '-';
    const lines = text.split('\n');
    for (const line of lines) {
      const s = String(line || '').trim();
      if (!s) continue;
      const msg = s.replace(/^F\d+\s+/, '');
      if (accept(msg)) return s;
    }
    for (const line of lines) {
      const s = String(line || '').trim();
      if (s) return s;
    }
    return '-';
  }

  renderBattleLoopStatus(snapshot) {
    const s = snapshot ?? this.actor.getSnapshot();
    const fmtArtShort = (art) => {
      if (!art) return null;
      const ready = art.ready ? ' READY' : '';
      return `${String(art.id ?? 'Art')} ${art.charge ?? 0}/${art.maxCharge ?? 0}${ready}`;
    };
    const arts = [fmtArtShort(s.art1), fmtArtShort(s.art2), fmtArtShort(s.art3), fmtArtShort(s.art4)].filter(Boolean);
    this.refs.blsArts.textContent = arts.length > 0 ? arts.join(' | ') : '-';

    const dcStage = s.driverCombo?.stage ?? 'None';
    this.refs.blsDriver.textContent = String(dcStage || 'None');

    const spCharge = Math.max(0, Number(s.specialGauge?.charge ?? 0));
    const spReady = Math.max(0, Number(s.specialGauge?.readyLevel ?? 0));
    this.refs.blsSpecial.textContent = `${spCharge | 0}/300 L${spReady | 0}`;

    const bcStage = s.bladeCombo?.stage ?? 'None';
    const bcRoute = s.bladeCombo?.routeId ?? '-';
    const nextElement = s.bladeCombo?.expectedNextElement ?? null;
    const nextMinLevel = s.bladeCombo?.expectedNextMinLevel ?? null;
    const bcNext = nextElement ? `${String(nextElement)} L${String(nextMinLevel ?? 0)}` : '-';
    this.refs.blsBlade.textContent = `${String(bcStage)} route=${String(bcRoute || '-')} next=${bcNext}`;

    const tokens = Array.isArray(s.tokens) ? s.tokens : [];
    this.refs.blsTokens.textContent = String(tokens.length | 0);
    this.renderTokens(tokens, this.refs.blsTokensList);

    const keyPrefixes = [
      'ActionHit',
      'ActionWhiffed',
      'RecoveryCanceledToMovement',
      'RecoveryCanceledToArt',
      'CancelBonusApplied',
      'ArtBecameReady',
      'ArtChargeChanged',
      'ArtConsumed',
      'DriverCombo',
      'Special',
      'BladeCombo',
      'TokenCreated',
    ];
    const lastKey = this.findLastEventLine(s.eventLogText, (msg) => keyPrefixes.some((p) => msg.startsWith(p)));
    this.refs.blsLastEvent.textContent = lastKey;
  }

  renderDriverCombo(driverCombo) {
    const stage = driverCombo?.stage ?? 'None';
    const framesLeft = Math.max(0, Number(driverCombo?.framesLeft ?? 0));
    const duration = Math.max(0, Number(driverCombo?.duration ?? 0));
    const ratio = duration > 0 ? Math.max(0, Math.min(1, framesLeft / duration)) : 0;

    this.refs.dcStage.textContent = stage;
    this.refs.dcBar.style.width = `${Math.round(ratio * 100)}%`;
    this.refs.dcFramesLeft.textContent = String(framesLeft | 0);
    this.refs.dcDuration.textContent = String(duration | 0);
  }

  renderBladeCombo(bladeCombo) {
    const stage = bladeCombo?.stage ?? 'None';
    const framesLeft = Math.max(0, Number(bladeCombo?.framesLeft ?? 0));
    const duration = Math.max(0, Number(bladeCombo?.duration ?? 0));
    const ratio = duration > 0 ? Math.max(0, Math.min(1, framesLeft / duration)) : 0;
    const routeId = bladeCombo?.routeId ?? '-';
    const nextElement = bladeCombo?.expectedNextElement ?? null;
    const nextMinLevel = bladeCombo?.expectedNextMinLevel ?? null;
    const expected = nextElement ? `${String(nextElement)} L${String(nextMinLevel ?? 0)}` : '-';

    this.refs.bcStage.textContent = stage;
    this.refs.bcBar.style.width = `${Math.round(ratio * 100)}%`;
    this.refs.bcFramesLeft.textContent = String(framesLeft | 0);
    this.refs.bcDuration.textContent = String(duration | 0);
    this.refs.bcRouteId.textContent = String(routeId || '-');
    this.refs.bcExpected.textContent = expected;
  }

  renderSpecialGauge(specialGauge) {
    const charge = Math.max(0, Number(specialGauge?.charge ?? 0));
    const ratio = Math.max(0, Math.min(1, Number(specialGauge?.ratio ?? 0)));
    const readyLevel = Math.max(0, Number(specialGauge?.readyLevel ?? 0));
    this.refs.spBar.style.width = `${Math.round(ratio * 100)}%`;
    this.refs.spInfo.textContent = `${charge | 0}/300 L${readyLevel | 0}`;
  }

  renderTokens(tokens, element = this.refs.tokensList) {
    const list = Array.isArray(tokens) ? tokens : [];
    if (list.length <= 0) {
      element.textContent = '-';
      return;
    }
    element.textContent = list
      .map((t, i) => `${String(i).padStart(2, '0')} ${t.id ?? 'Token'} element=${t.element ?? '?'} route=${t.sourceRouteId ?? '-'} @${t.createdFrame ?? 0}`)
      .join('\n');
  }

  renderSingleDriverMvp(snapshot) {
    const s = snapshot ?? this.actor.getSnapshot();
    const battleActive = s.battle?.active === false ? 'inactive' : 'active';
    const battleResult = s.battle?.result ?? '-';
    this.refs.mvpBattle.textContent = `${battleActive} result=${String(battleResult)}`;

    const hp = Math.max(0, Number(s.target?.hp ?? 0));
    const maxHp = Math.max(0, Number(s.target?.maxHp ?? 0));
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const dead = s.target?.dead === true;
    this.refs.mvpTargetHpText.textContent = `${hp | 0}/${maxHp | 0}${dead ? ' DEAD' : ''}`;
    this.refs.mvpTargetHpBar.style.width = `${Math.round(ratio * 100)}%`;

    const tiles = Array.isArray(s.routineTiles) ? s.routineTiles : [];
    if (tiles.length <= 0) {
      this.refs.mvpTiles.textContent = '-';
    } else {
      const label = tiles.map((t) => `${t.skillId ?? '?'} L${t.layer ?? 0}`).join(' | ');
      this.refs.mvpTiles.textContent = label;
    }

    const orb = s.routineOrb;
    this.refs.mvpOrb.textContent = orb ? `${orb.routineId ?? '?'} L${orb.totalLayer ?? 0}` : '-';

    const debuffs = Array.isArray(s.debuffs) ? s.debuffs : [];
    const burn = debuffs.find((d) => d?.type === 'Burn' && (d?.framesLeft ?? 0) > 0) ?? null;
    this.refs.mvpBurn.textContent = burn ? `Burn ${(burn.framesLeft ?? 0) | 0}f` : '-';

    const keyPrefixes = [
      'RoutineTile',
      'RoutineOrb',
      'ElementDamageApplied',
      'Debuff',
      'DamageApplied',
      'TargetHpChanged',
      'TargetDefeated',
      'BattleEnded',
    ];
    const lastKey = this.findLastEventLine(s.eventLogText, (msg) => keyPrefixes.some((p) => msg.startsWith(p)));
    this.refs.mvpLastEvent.textContent = lastKey;
  }

  renderEnemyPlayerPanel(snapshot) {
    const s = snapshot ?? this.actor.getSnapshot();
    const enemy = s.enemy ?? null;

    const enemyState = enemy?.state ?? '-';
    this.refs.epEnemyState.textContent = String(enemyState || '-');
    this.refs.epEnemyAction.textContent = enemy?.currentAction?.id ?? 'None';
    this.refs.epEnemyPhase.textContent = enemy?.currentAction?.phase ?? 'None';

    const cooldownLeft = Math.max(0, Number(enemy?.cooldownLeft ?? 0)) | 0;
    const cooldownFrames = Math.max(0, Number(enemy?.attackSpec?.cooldownFrames ?? 0)) | 0;
    this.refs.epEnemyCooldown.textContent = cooldownFrames > 0 ? `${cooldownLeft}/${cooldownFrames}f` : `${cooldownLeft}f`;

    const enemyHp = Math.max(0, Number(enemy?.hp ?? 0)) | 0;
    const enemyMaxHp = Math.max(0, Number(enemy?.maxHp ?? 0)) | 0;
    const enemyDead = enemy?.dead === true;
    this.refs.epEnemyHp.textContent = enemyMaxHp > 0 ? `${enemyHp}/${enemyMaxHp}${enemyDead ? ' DEAD' : ''}` : '-';

    const playerHp = Math.max(0, Number(s.player?.hp ?? 0)) | 0;
    const playerMaxHp = Math.max(0, Number(s.player?.maxHp ?? 0)) | 0;
    const playerDead = s.player?.dead === true;
    this.refs.epPlayerHp.textContent = playerMaxHp > 0 ? `${playerHp}/${playerMaxHp}${playerDead ? ' DEAD' : ''}` : '-';

    const battleActive = s.battle?.active === false ? 'inactive' : 'active';
    const battleResult = s.battle?.result ?? '-';
    this.refs.epBattleResult.textContent = `${battleActive} result=${String(battleResult)}`;

    const keyPrefixes = [
      'EnemyAttack',
      'EnemyStrike',
      'EnemyControlled',
      'PlayerDamageApplied',
      'PlayerHpChanged',
      'PlayerDefeated',
      'BattleEnded',
    ];
    const lastKey = this.findLastEventLine(s.eventLogText, (msg) => keyPrefixes.some((p) => msg.startsWith(p)));
    this.refs.epLastEnemyEvent.textContent = lastKey;
  }

  runScenario(name) {
    const scenario = getScenario(name);
    const prevAutoAttackRange = this.actor.getSnapshot().autoAttackRange;
    this.actor.paused = true;

    const result = runScenarioCore({
      actor: this.actor,
      name: scenario.name,
      maxFrames: scenario.maxFrames,
      steps: scenario.steps,
      prepare: scenario.prepare,
      logToConsole: false,
    });

    this.actor.paused = true;
    this.actor.autoAttackRange = prevAutoAttackRange;
    this.setScenarioResult(result);
    this.render(this.actor.getSnapshot());
  }

  grantEnemyCooldownReady() {
    this.actor.paused = true;
    if (typeof this.actor.debugGrantEnemyCooldownReady === 'function') {
      this.actor.debugGrantEnemyCooldownReady({ tickAfter: true });
    } else {
      if (this.actor.enemy) this.actor.enemy.cooldownLeft = 0;
      this.actor.tick(new CombatInputFrame());
    }
    this.render(this.actor.getSnapshot());
  }

  grantAllArtsReady() {
    this.actor.paused = true;
    const data = {};
    for (const art of this.actor.arts ?? []) {
      art.charge = art.maxCharge;
      data[art.id] = { charge: art.charge, maxCharge: art.maxCharge };
    }
    this.actor.emit(CombatEventType.DebugGrantArtsReady, data);
    this.render(this.actor.getSnapshot());
  }

  grantSpecialLevel(level) {
    this.actor.paused = true;
    this.actor.debugGrantSpecialReady({ level });
    this.render(this.actor.getSnapshot());
  }

  castSpecial(specialId) {
    this.actor.paused = true;
    this.actor.castSpecial(String(specialId));
    this.actor.tick(new CombatInputFrame());
    this.render(this.actor.getSnapshot());
  }

  castArt(slot) {
    this.actor.paused = true;
    this.actor.tick(new CombatInputFrame({ artSlotsPressed: [slot] }));
    this.render(this.actor.getSnapshot());
  }

  stepToRecovery() {
    this.actor.paused = true;
    const max = 600;
    for (let i = 0; i < max; i += 1) {
      const s = this.actor.getSnapshot();
      if (s.state === ActorState.AutoAttack && s.action?.phase === ActionPhase.Recovery) break;
      this.actor.tick(new CombatInputFrame());
    }
    this.render(this.actor.getSnapshot());
  }

  render(snapshot) {
    const s = snapshot ?? this.actor.getSnapshot();
    const action = s.action;
    const art1 = s.art1;
    const art2 = s.art2;
    const art3 = s.art3;
    const art4 = s.art4;
    const fmtArt = (art) => {
      if (!art) return '-';
      const ready = art.ready ? ' READY' : '';
      return `${art.charge}/${art.maxCharge}${ready}`;
    };

    this.refs.frame.textContent = String(s.frame);
    this.refs.state.textContent = s.state;
    this.refs.action.textContent = action ? action.id : 'None';
    this.refs.phase.textContent = action ? action.phase : 'None';

    this.refs.actionBar.style.width = `${Math.round((action ? action.progress01 : 0) * 100)}%`;
    this.refs.chargeBar.style.width = `${Math.round((art1 ? art1.charge / art1.maxCharge : 0) * 100)}%`;
    this.refs.cancelBar.style.width = `${Math.round(s.cancelBonus.ratio * 100)}%`;
    this.refs.bufferBar.style.width = `${Math.round(s.inputBuffer.ratio * 100)}%`;
    this.refs.art1Info.textContent = fmtArt(art1);
    this.refs.art2Info.textContent = fmtArt(art2);
    this.refs.art3Info.textContent = fmtArt(art3);
    this.refs.art4Info.textContent = fmtArt(art4);
    this.refs.log.textContent = s.eventLogText;
    this.renderBattleLoopStatus(s);
    this.renderDriverCombo(s.driverCombo);
    this.refs.dcLastEvent.textContent = this.findLastEventLine(s.eventLogText, (msg) => msg.startsWith('DriverCombo'));
    this.renderBladeCombo(s.bladeCombo);
    this.renderSpecialGauge(s.specialGauge);
    this.renderTokens(s.tokens);
    this.renderSingleDriverMvp(s);
    this.renderEnemyPlayerPanel(s);
  }
}
