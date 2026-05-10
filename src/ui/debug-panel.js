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
  }
}
