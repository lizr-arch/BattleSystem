import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';
import { CombatEventType } from '../src/core/enums.js';

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
  const { actor, result } = run('routine-orb-create');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.routineOrb?.routineId, 'FireRoutine');
  assert.equal(result.finalSnapshot.routineOrb?.totalLayer, 6);
  assert.equal(result.finalSnapshot.routineTiles?.length ?? 0, 3);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.RoutineTileAdded));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.RoutineOrbCreated));
}

{
  const { actor, result } = run('routine-orb-break');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.routineOrb, null);
  assert.equal(result.finalSnapshot.routineTiles?.length ?? 0, 0);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.ElementDamageApplied && e.data?.element === 'Fire' && e.data?.amount === 120));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DebuffApplied && e.data?.type === 'Burn'));
}

{
  const { actor, result } = run('routine-orb-break-without-orb');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.routineOrb, null);
  assert.equal(result.finalSnapshot.routineTiles?.length ?? 0, 0);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.RoutineOrbBreakFailed && e.data?.reason === 'no_orb'));
}

{
  const { actor, result } = run('routine-burn-kill');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.battle?.result, 'Victory');
  assert.equal(result.finalSnapshot.target?.dead, true);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DebuffTickDamage && e.data?.type === 'Burn' && e.data?.amount === 5));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.TargetDefeated));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BattleEnded && e.data?.result === 'Victory'));
}

console.log('routine orb scenario test passed');

