import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';
import { BladeComboElement, BladeComboStage, CombatEventType, DriverComboStage } from '../src/core/enums.js';

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
  const { actor, result } = run('full-blade-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.None);
  assert.equal(result.finalSnapshot.tokens.length, 1);
  assert.equal(result.finalSnapshot.tokens[0].id, 'FireToken');
  assert.equal(result.finalSnapshot.tokens[0].sourceRouteId, 'FireWaterFire');
  assert.ok(Number.isFinite(result.finalSnapshot.tokens[0].createdFrame));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboStarted && e.data?.element === BladeComboElement.Fire));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboAdvanced && e.data?.element === BladeComboElement.Water));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboFinished && e.data?.element === BladeComboElement.Fire));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.TokenCreated && e.data?.id === 'FireToken'));
}

{
  const { actor, result } = run('wrong-element-blade-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.Stage1);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboFailed && e.data?.reason === 'wrong_element'));
}

{
  const { actor, result } = run('insufficient-level-blade-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.Stage2);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboFailed && e.data?.reason === 'insufficient_level' && e.data?.requiresMinLevel === 3));
}

{
  const { actor, result } = run('expire-blade-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.None);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboExpired && e.data?.stage === BladeComboStage.Stage1));
}

{
  const { actor, result } = run('driver-and-blade-coexist');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.Topple);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.Stage1);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboApplied && e.data?.stage === DriverComboStage.Break));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboStarted && e.data?.routeId === 'FireWaterFire'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboAdvanced && e.data?.toStage === DriverComboStage.Topple));
}

{
  const { actor, result } = run('full-battle-loop');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.None);
  assert.ok(result.finalSnapshot.tokens.some((t) => t.id === 'FireToken'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DriverComboFinished));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.SpecialHit && e.data?.specialId === 'FireLv1'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.SpecialHit && e.data?.specialId === 'WaterLv2'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.SpecialHit && e.data?.specialId === 'FireLv3'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BladeComboFinished && e.data?.routeId === 'FireWaterFire'));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.TokenCreated && e.data?.id === 'FireToken'));
}

console.log('blade combo scenario test passed');
