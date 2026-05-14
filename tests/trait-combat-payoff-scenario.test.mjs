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

// Scenario 1: trait-fierce-followup-damage
{
  const { actor, result } = run('trait-fierce-followup-damage');
  assert.equal(result.passed, true, 'trait-fierce-followup-damage should pass');
  const events = actor.eventLog?.events ?? [];
  const hitEvs = events.filter((e) => String(e.type) === String(CombatEventType.BladeAttackHit));
  assert.ok(hitEvs.length > 0, 'BladeAttackHit should have occurred');
  const payoffEvs = events.filter((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated) && e.data?.payoffId === 'FierceFollowUp');
  assert.ok(payoffEvs.length > 0, 'FierceFollowUp payoff should have occurred');
  const dmgEvs = events.filter((e) => String(e.type) === String(CombatEventType.DamageApplied) && e.data?.source === 'TraitPayoff' && e.data?.sourceId === 'FierceFollowUp');
  assert.ok(dmgEvs.length > 0, 'FierceFollowUp damage should be applied');
  console.log('PASS scenario: trait-fierce-followup-damage');
}

// Scenario 2: trait-loyal-guard-reduces-player-damage
{
  const { actor, result } = run('trait-loyal-guard-reduces-player-damage');
  assert.equal(result.passed, true, 'trait-loyal-guard-reduces-player-damage should pass');
  const events = actor.eventLog?.events ?? [];
  const payoffEvs = events.filter((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated) && e.data?.payoffId === 'LoyalGuard');
  assert.ok(payoffEvs.length > 0, 'LoyalGuard payoff should have occurred');
  console.log('PASS scenario: trait-loyal-guard-reduces-player-damage');
}

// Scenario 3: trait-proud-sync-strike-on-sync-trigger
{
  const { actor, result } = run('trait-proud-sync-strike-on-sync-trigger');
  assert.equal(result.passed, true, 'trait-proud-sync-strike-on-sync-trigger should pass');
  const events = actor.eventLog?.events ?? [];
  const payoffEvs = events.filter((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated) && e.data?.payoffId === 'ProudSyncStrike');
  assert.ok(payoffEvs.length > 0, 'ProudSyncStrike payoff should have occurred');
  const dmgEvs = events.filter((e) => String(e.type) === String(CombatEventType.DamageApplied) && e.data?.source === 'TraitPayoff' && e.data?.sourceId === 'ProudSyncStrike');
  assert.ok(dmgEvs.length > 0, 'ProudSyncStrike damage should be applied');
  console.log('PASS scenario: trait-proud-sync-strike-on-sync-trigger');
}

// Scenario 4: trait-payoff-requires-combat-slot
{
  const { actor, result } = run('trait-payoff-requires-combat-slot');
  assert.equal(result.passed, true, 'trait-payoff-requires-combat-slot should pass');
  const events = actor.eventLog?.events ?? [];
  const payoffEvs = events.filter((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated));
  assert.strictEqual(payoffEvs.length, 0, 'No TraitPayoffActivated should occur without combat slot');
  console.log('PASS scenario: trait-payoff-requires-combat-slot');
}

console.log('trait combat payoff scenario tests passed');
