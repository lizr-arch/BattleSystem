import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';
import { CombatEventType, DriverComboEffect, DriverComboStage } from '../src/core/enums.js';

function run(name) {
  const actor = createDefaultCombatActor();
  const scenario = getScenario(name);
  const result = runScenario({
    actor,
    name: scenario.name,
    maxFrames: scenario.maxFrames,
    steps: scenario.steps,
    prepare: scenario.prepare,
    logToConsole: false,
  });
  return { actor, result };
}

{
  const { actor, result } = run('full-driver-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DebugGrantArtsReady));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboApplied && e.data?.effect === DriverComboEffect.Break));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboAdvanced && e.data?.effect === DriverComboEffect.Topple));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboAdvanced && e.data?.effect === DriverComboEffect.Launch));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboFinished && e.data?.effect === DriverComboEffect.Smash));
}

{
  const { actor, result } = run('wrong-order-smash');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboFailed && e.data?.effect === DriverComboEffect.Smash));
}

{
  const { actor, result } = run('expire-break');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboExpired && e.data?.stage === DriverComboStage.Break));
}

{
  const { actor, result } = run('expire-topple');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboExpired && e.data?.stage === DriverComboStage.Topple));
}

console.log('driver combo scenario test passed');
