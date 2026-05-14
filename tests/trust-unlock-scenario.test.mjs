import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatEventType } from '../src/core/enums.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

function run(name) {
  const actor = createDefaultCombatActor();
  const scenario = getScenario(name);
  assert.ok(scenario, `Scenario should exist: ${name}`);
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

// Scenario 1: trust-lv1-no-combat-slot
{
  const { actor, result } = run('trust-lv1-no-combat-slot');
  assert.equal(result.passed, true, 'trust-lv1-no-combat-slot should pass');
  const blade = actor.resolvedLoadout?.activeBlades?.[0];
  assert.ok(blade, 'activeBlade should exist');
  assert.ok(blade.unlocks, 'unlocks should exist');
  assert.deepStrictEqual(blade.unlocks.combatSlots, [], 'combatSlots should be empty at Lv1');
  console.log('PASS scenario: trust-lv1-no-combat-slot');
}

// Scenario 2: trust-lv3-unlocks-combat-slot
{
  const { actor, result } = run('trust-lv3-unlocks-combat-slot');
  assert.equal(result.passed, true, 'trust-lv3-unlocks-combat-slot should pass');
  const blade = actor.resolvedLoadout?.activeBlades?.[0];
  assert.ok(blade, 'activeBlade should exist');
  assert.strictEqual(blade.bond?.trustLevel, 3, 'bond trustLevel must be 3');
  assert.ok(blade.unlocks?.combatSlots?.includes('BondCombatSlot1'), 'BondCombatSlot1 must be derived from trustLevel=3 via refresh');
  console.log('PASS scenario: trust-lv3-unlocks-combat-slot');
}

// Scenario 3: trust-unlock-survives-reset
{
  const { actor, result } = run('trust-unlock-survives-reset');
  assert.equal(result.passed, true, 'trust-unlock-survives-reset should pass');
  const blade = actor.resolvedLoadout?.activeBlades?.[0];
  assert.strictEqual(blade?.bond?.trustLevel, 3, 'trustLevel must survive reset');
  assert.ok(blade?.unlocks?.combatSlots?.includes('BondCombatSlot1'), 'unlock must survive reset (derived from bond)');
  console.log('PASS scenario: trust-unlock-survives-reset');
}

// Scenario 4: trust-unlock-survives-defeat
{
  const { actor, result } = run('trust-unlock-survives-defeat');
  assert.equal(result.passed, true, 'trust-unlock-survives-defeat should pass');
  const events = actor.eventLog?.events ?? [];
  const defEvent = events.find((e) => String(e.type) === String(CombatEventType.BattleEnded) && e.data?.result === 'Defeat');
  assert.ok(defEvent, 'Defeat should have occurred');
  const blade = actor.resolvedLoadout?.activeBlades?.[0];
  assert.ok(blade?.bond?.trustLevel >= 3, 'trustLevel should remain >= 3 after defeat');
  assert.ok(blade?.unlocks?.combatSlots?.includes('BondCombatSlot1'), 'unlock must survive defeat (derived from bond)');
  console.log('PASS scenario: trust-unlock-survives-defeat');
}

console.log('trust unlock scenario tests passed');
