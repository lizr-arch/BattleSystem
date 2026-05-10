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
      dcStage: this.byId('dcStage'),
      dcBar: this.byId('dcBar'),
      dcFramesLeft: this.byId('dcFramesLeft'),
      dcDuration: this.byId('dcDuration'),
      dcLastEvent: this.byId('dcLastEvent'),
      scFull: this.byId('scFull'),
      scWrong: this.byId('scWrong'),
      scExpireBreak: this.byId('scExpireBreak'),
      scExpireTopple: this.byId('scExpireTopple'),
      scResult: this.byId('scResult'),
      scProof: this.byId('scProof'),
      dbgGrantReady: this.byId('dbgGrantReady'),
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

  bindControls({ onPause, onStep, onReset, onClear }) {
    this.refs.pause.addEventListener('click', onPause);
    this.refs.step.addEventListener('click', onStep);
    this.refs.reset.addEventListener('click', onReset);
    this.refs.clear.addEventListener('click', onClear);

    const sync = () => this.applyTuning();
    this.refs.buffer.addEventListener('input', sync);
    this.refs.cancel.addEventListener('input', sync);
    this.refs.maxCharge.addEventListener('input', sync);
    this.applyTuning();

    this.refs.scFull.addEventListener('click', () => this.runScenario('full-driver-combo'));
    this.refs.scWrong.addEventListener('click', () => this.runScenario('wrong-order-smash'));
    this.refs.scExpireBreak.addEventListener('click', () => this.runScenario('expire-break'));
    this.refs.scExpireTopple.addEventListener('click', () => this.runScenario('expire-topple'));

    this.refs.dbgGrantReady.addEventListener('click', () => this.grantAllArtsReady());
    this.refs.dbgStepToRecovery.addEventListener('click', () => this.stepToRecovery());
    this.refs.dbgCast1.addEventListener('click', () => this.castArt(0));
    this.refs.dbgCast2.addEventListener('click', () => this.castArt(1));
    this.refs.dbgCast3.addEventListener('click', () => this.castArt(2));
    this.refs.dbgCast4.addEventListener('click', () => this.castArt(3));
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

  findLastDriverEventMessage() {
    const events = this.actor.eventLog?.events ?? [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i];
      if (String(e.type).startsWith('DriverCombo')) return String(e.message ?? e.type);
    }
    return '-';
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

  runScenario(name) {
    const scenario = getScenario(name);
    const prevAutoAttackRange = this.actor.autoAttackRange;
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
    this.renderDriverCombo(s.driverCombo);
    this.refs.dcLastEvent.textContent = this.findLastDriverEventMessage();
  }
}
