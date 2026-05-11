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

function hasType(events, type) {
  return events.some((e) => e.type === type);
}

{
  const { actor, result } = run('single-driver-routine-orb-victory');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.battle?.result, 'Victory');
  assert.equal(result.finalSnapshot.target?.dead, true);
  assert.equal(result.finalSnapshot.routineOrb, null);

  const events = actor.eventLog.events;
  assert.equal(hasType(events, CombatEventType.BattleStarted), true);
  assert.equal(hasType(events, CombatEventType.ActionHit), true);
  assert.equal(hasType(events, CombatEventType.DamageApplied), true);
  assert.equal(hasType(events, CombatEventType.TargetHpChanged), true);
  assert.equal(hasType(events, CombatEventType.RoutineTileAdded), true);
  assert.equal(hasType(events, CombatEventType.RoutineOrbCreated), true);
  assert.equal(hasType(events, CombatEventType.RoutineOrbBroken), true);
  assert.equal(hasType(events, CombatEventType.ElementDamageApplied), true);
  assert.equal(hasType(events, CombatEventType.DebuffApplied), true);
  assert.equal(hasType(events, CombatEventType.DebuffTickDamage), true);
  assert.equal(hasType(events, CombatEventType.TargetDefeated), true);
  assert.equal(events.some((e) => e.type === CombatEventType.BattleEnded && e.data?.result === 'Victory'), true);
}

console.log('single driver mvp test passed');

