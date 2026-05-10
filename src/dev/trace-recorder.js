function clampInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x | 0;
}

function fmtEvent(e) {
  return {
    frame: clampInt(e.frame),
    type: String(e.type),
    message: String(e.message ?? '')
  };
}

function fmtAction(action) {
  if (!action) return null;
  return {
    id: String(action.id ?? 'None'),
    phase: String(action.phase ?? 'None')
  };
}

function fmtArt(art) {
  if (!art) return null;
  return {
    id: String(art.id ?? '?'),
    charge: clampInt(art.charge),
    maxCharge: clampInt(art.maxCharge),
    ready: Boolean(art.ready)
  };
}

export class TraceRecorder {
  constructor({ maxFrames = 1000 } = {}) {
    this.maxFrames = Math.max(1, clampInt(maxFrames));
    this.records = [];
    this.lastHeadEvent = null;
  }

  record(actor, { note = '' } = {}) {
    const snapshot = actor.getSnapshot();
    const events = actor.eventLog?.events ?? [];
    const newEvents = [];
    for (const e of events) {
      if (e === this.lastHeadEvent) break;
      newEvents.push(e);
    }
    this.lastHeadEvent = events[0] ?? null;

    const frame = clampInt(snapshot.frame);
    const eventsThisFrame = newEvents
      .filter((e) => clampInt(e.frame) === frame)
      .map(fmtEvent);

    const record = {
      frame,
      state: String(snapshot.state),
      action: fmtAction(snapshot.action),
      arts: [fmtArt(snapshot.art1), fmtArt(snapshot.art2), fmtArt(snapshot.art3), fmtArt(snapshot.art4)].filter(Boolean),
      driverCombo: {
        stage: String(snapshot.driverCombo?.stage ?? 'None'),
        framesLeft: clampInt(snapshot.driverCombo?.framesLeft),
        duration: clampInt(snapshot.driverCombo?.duration),
      },
      inputBuffer: {
        hasArt: Boolean(snapshot.inputBuffer?.hasArt),
        slot: snapshot.inputBuffer?.slot ?? null,
        ratio: Number(snapshot.inputBuffer?.ratio ?? 0),
        maxFrames: clampInt(snapshot.inputBuffer?.maxFrames),
      },
      eventsThisFrame,
      note: String(note || ''),
    };

    this.records.push(record);
    if (this.records.length > this.maxFrames) {
      this.records.splice(0, this.records.length - this.maxFrames);
    }

    return record;
  }

  getTail(count = 30) {
    const n = Math.max(0, clampInt(count));
    return this.records.slice(Math.max(0, this.records.length - n));
  }

  formatTail(count = 30) {
    return this.getTail(count).map((r) => {
      const action = r.action ? `${r.action.id}/${r.action.phase}` : 'None';
      const dc = `${r.driverCombo.stage} ${r.driverCombo.framesLeft}/${r.driverCombo.duration}`;
      const buf = r.inputBuffer.hasArt ? `buf(slot=${String(r.inputBuffer.slot)})` : 'buf(-)';
      const ev = r.eventsThisFrame.map((e) => e.message || e.type).join(' | ');
      const note = r.note ? ` ${r.note}` : '';
      return `${String(r.frame).padStart(5, ' ')} ${r.state} ${action} dc=${dc} ${buf}${note}${ev ? ` :: ${ev}` : ''}`;
    }).join('\n');
  }
}
