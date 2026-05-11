import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatEventType } from '../src/core/enums.js';
import { assertEvent, assertSnapshot, breakRoutineOrb, runScenario, waitFrames } from '../src/dev/scenario-runner.js';

function createInRangeNoAuto() {
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.autoAttackRange = 0;
  return actor;
}

function captureConsole(fn) {
  const out = [];
  const prev = console.log;
  console.log = (...args) => { out.push(args.map(String).join(' ')); };
  try {
    fn();
  } finally {
    console.log = prev;
  }
  return out.join('\n');
}

{
  const actor = createInRangeNoAuto();
  const output = captureConsole(() => {
    const result = runScenario({
      actor,
      name: 'fail-fast',
      maxFrames: 60,
      steps: [
        assertSnapshot(() => false, 'AlwaysFail'),
      ],
    });

    assert.equal(result.passed, false);
    assert.equal(result.failedStep.label, 'AlwaysFail');
    assert.ok(Array.isArray(result.trace));
  });

  assert.ok(output.includes('Scenario FAIL: fail-fast'));
  assert.ok(output.includes('Failed step: AlwaysFail'));
  assert.ok(output.includes('start'));
}

{
  const actor = createInRangeNoAuto();
  const output = captureConsole(() => {
    const result = runScenario({
      actor,
      name: 'happy',
      maxFrames: 120,
      steps: [
        waitFrames(3, 'Advance3'),
        assertSnapshot((s) => s.driverCombo?.stage === 'None', 'StageNone'),
      ],
    });

    assert.equal(result.passed, true);
    assert.equal(result.failedStep, null);
    assert.ok(result.proof.some((p) => p.label === 'Advance3'));
  });

  assert.ok(output.includes('Scenario PASS: happy'));
  assert.ok(output.includes('Advance3'));
  assert.ok(output.includes('StageNone'));
}

{
  const actor = createInRangeNoAuto();
  const output = captureConsole(() => {
    const result = runScenario({
      actor,
      name: 'break-routine-orb-no-orb',
      maxFrames: 30,
      steps: [
        breakRoutineOrb('BreakNoOrb'),
        assertEvent(CombatEventType.RoutineOrbBreakFailed, (e) => e.data?.reason === 'no_orb', 'Assert RoutineOrbBreakFailed no_orb'),
      ],
    });

    assert.equal(result.passed, true);
    assert.ok(result.proof.some((p) => p.label === 'BreakNoOrb'));
    assert.ok(result.proof.some((p) => p.label === 'Assert RoutineOrbBreakFailed no_orb'));
  });

  assert.ok(output.includes('Scenario PASS: break-routine-orb-no-orb'));
  assert.ok(output.includes('BreakNoOrb'));
}

console.log('scenario runner test passed');
