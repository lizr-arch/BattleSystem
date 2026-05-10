import { CombatInputFrame } from '../core/combat-input.js';
import { CombatEventType } from '../core/enums.js';
import { TraceRecorder } from './trace-recorder.js';

function clampInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x | 0;
}

function findEvent(events, type, predicate) {
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (String(e.type) !== String(type)) continue;
    if (!predicate || predicate(e)) return e;
  }
  return null;
}

export function waitUntil(predicate, label, { timeoutFrames } = {}) {
  return { kind: 'waitUntil', predicate, label: String(label), timeoutFrames };
}

export function waitFrames(frames, label = '') {
  return { kind: 'waitFrames', frames: clampInt(frames), label: String(label || `waitFrames(${frames})`) };
}

export function castArt(slot, label = '') {
  return { kind: 'castArt', slot: clampInt(slot), label: String(label || `castArt(${slot})`) };
}

export function castSpecial(slotOrId, label = '') {
  const isId = typeof slotOrId === 'string';
  return {
    kind: 'castSpecial',
    slot: isId ? null : clampInt(slotOrId),
    specialId: isId ? String(slotOrId) : null,
    label: String(label || `castSpecial(${String(slotOrId)})`)
  };
}

export function grantSpecialReady(charge = 300, label = '') {
  return { kind: 'grantSpecialReady', charge: clampInt(charge), label: String(label || `grantSpecialReady(${String(charge)})`) };
}

export function assertSnapshot(predicate, label) {
  return { kind: 'assertSnapshot', predicate, label: String(label) };
}

export function assertEvent(type, predicate, label) {
  return { kind: 'assertEvent', type: String(type), predicate, label: String(label) };
}

export function runScenario({
  actor,
  name,
  maxFrames = 3000,
  steps = [],
  prepare = null,
  traceMaxFrames = 1000,
  logToConsole = true,
} = {}) {
  if (!actor) throw new Error('runScenario requires actor');
  const scenarioName = String(name || 'scenario');
  const limit = Math.max(1, clampInt(maxFrames));
  const recorder = new TraceRecorder({ maxFrames: traceMaxFrames });
  const proof = [];

  if (typeof prepare === 'function') {
    prepare(actor);
  }

  recorder.record(actor, { note: 'start' });

  const allEvents = () => actor.eventLog?.events ?? [];

  let framesElapsed = 0;
  let stepIndex = 0;
  let currentWaitFramesLeft = null;
  let currentWaitUntilLeft = null;

  const fail = (label, details) => {
    const result = {
      name: scenarioName,
      passed: false,
      failedStep: { index: stepIndex, label: String(label) },
      framesElapsed,
      proof: [...proof, { frame: actor.frame, ok: false, label: String(label), details }],
      finalSnapshot: actor.getSnapshot(),
      trace: recorder.records.slice(),
    };

    if (logToConsole) {
      console.log(`Scenario FAIL: ${scenarioName}`);
      console.log(`Failed step: ${String(label)}`);
      console.log(recorder.formatTail(30));
    }

    return result;
  };

  const passStep = (label, details = {}) => {
    proof.push({ frame: actor.frame, ok: true, label: String(label), details });
    stepIndex += 1;
    currentWaitFramesLeft = null;
    currentWaitUntilLeft = null;
  };

  while (stepIndex < steps.length && framesElapsed < limit) {
    const step = steps[stepIndex];
    if (!step || !step.kind) return fail('InvalidStep', { stepIndex });

    const kind = step.kind;
    const label = step.label || kind;

    if (kind === 'assertSnapshot') {
      const snapshot = actor.getSnapshot();
      let ok = false;
      try {
        ok = Boolean(step.predicate(snapshot, { actor, events: allEvents() }));
      } catch (e) {
        return fail(label, { error: String(e?.message ?? e) });
      }
      if (!ok) return fail(label, { snapshot });
      passStep(label);
      continue;
    }

    if (kind === 'assertEvent') {
      const e = findEvent(allEvents(), step.type, step.predicate);
      if (!e) return fail(label, { expectedType: step.type });
      passStep(label, { event: { frame: e.frame, type: e.type, message: e.message, data: e.data } });
      continue;
    }

    if (kind === 'waitFrames') {
      if (currentWaitFramesLeft === null) currentWaitFramesLeft = Math.max(0, clampInt(step.frames));
      if (currentWaitFramesLeft <= 0) {
        passStep(label, { waited: clampInt(step.frames) });
        continue;
      }

      actor.tick(new CombatInputFrame());
      framesElapsed += 1;
      currentWaitFramesLeft -= 1;
      recorder.record(actor, { note: label });
      continue;
    }

    if (kind === 'waitUntil') {
      if (currentWaitUntilLeft === null) {
        const t = step.timeoutFrames === undefined ? (limit - framesElapsed) : clampInt(step.timeoutFrames);
        currentWaitUntilLeft = Math.max(0, t);
      }

      const snapshot = actor.getSnapshot();
      let ok = false;
      try {
        ok = Boolean(step.predicate(snapshot, { actor, events: allEvents() }));
      } catch (e) {
        return fail(label, { error: String(e?.message ?? e) });
      }

      if (ok) {
        passStep(label);
        continue;
      }

      if (currentWaitUntilLeft <= 0) {
        return fail(label, { reason: 'timeout', snapshot });
      }

      actor.tick(new CombatInputFrame());
      framesElapsed += 1;
      currentWaitUntilLeft -= 1;
      recorder.record(actor, { note: label });
      continue;
    }

    if (kind === 'castArt') {
      actor.tick(new CombatInputFrame({ artSlotsPressed: [clampInt(step.slot)] }));
      framesElapsed += 1;
      recorder.record(actor, { note: label });
      passStep(label, { slot: clampInt(step.slot) });
      continue;
    }

    if (kind === 'grantSpecialReady') {
      const max = actor.specialGauge?.threshold3 ?? 300;
      const charge = Math.max(0, Math.min(max | 0, clampInt(step.charge)));
      actor.specialGauge.charge = charge;
      actor.emit(CombatEventType.DebugGrantSpecialReady, { charge });
      recorder.record(actor, { note: label });
      passStep(label, { charge });
      continue;
    }

    if (kind === 'castSpecial') {
      const id = step.specialId ? String(step.specialId) : null;
      const slot = step.slot === null || step.slot === undefined ? null : clampInt(step.slot);
      const ok = actor.castSpecial(id ?? slot ?? 0);
      actor.tick(new CombatInputFrame());
      framesElapsed += 1;
      recorder.record(actor, { note: label });
      passStep(label, { ok, specialId: id, slot });
      continue;
    }

    return fail('UnknownStepKind', { kind });
  }

  if (stepIndex < steps.length) {
    const label = steps[stepIndex]?.label || steps[stepIndex]?.kind || 'Unknown';
    return fail(label, { reason: 'maxFramesReached', maxFrames: limit });
  }

  const result = {
    name: scenarioName,
    passed: true,
    failedStep: null,
    framesElapsed,
    proof,
    finalSnapshot: actor.getSnapshot(),
    trace: recorder.records.slice(),
  };

  if (logToConsole) {
    console.log(`Scenario PASS: ${scenarioName}`);
    for (const p of proof) {
      console.log(`- [${String(p.frame)}] ${p.label}`);
    }
  }

  return result;
}
