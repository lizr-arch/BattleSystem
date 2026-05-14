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

// Scenario 1: demo-preset-create
{
  const { actor, result } = run('demo-preset-create');
  assert.equal(result.passed, true, 'demo-preset-create should pass');
  const snap = actor.getSnapshot();
  assert.strictEqual(snap.player?.hp, 240, 'Player HP should be 240');
  assert.strictEqual(snap.target?.hp, 650, 'Target HP should be 650');
  const blades = snap.resolvedLoadout?.activeBlades ?? [];
  assert.ok(blades.length >= 2, 'Should have 2 active blades');
  console.log('PASS scenario: demo-preset-create');
}

// Scenario 2: demo-preset-fierce-follow-up
{
  const { actor, result } = run('demo-preset-fierce-follow-up');
  assert.equal(result.passed, true, 'demo-preset-fierce-follow-up should pass');
  const events = actor.eventLog?.events ?? [];
  const payoffEvs = events.filter((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated) && e.data?.payoffId === 'FierceFollowUp');
  assert.ok(payoffEvs.length > 0, 'FierceFollowUp payoff should have occurred');
  console.log('PASS scenario: demo-preset-fierce-follow-up');
}

// Scenario 3: demo-preset-enemy-damages-player
{
  const { actor, result } = run('demo-preset-enemy-damages-player');
  assert.equal(result.passed, true, 'demo-preset-enemy-damages-player should pass');
  const events = actor.eventLog?.events ?? [];
  const enemyHitEvs = events.filter((e) => String(e.type) === String(CombatEventType.EnemyAttackHit));
  assert.ok(enemyHitEvs.length > 0, 'EnemyAttackHit should have occurred');
  const playerDmgEvs = events.filter((e) => String(e.type) === String(CombatEventType.PlayerDamageApplied));
  assert.ok(playerDmgEvs.length > 0, 'PlayerDamageApplied should have occurred');
  console.log('PASS scenario: demo-preset-enemy-damages-player');
}

// Scenario 4: demo-preset-reset
{
  const { actor, result } = run('demo-preset-reset');
  assert.equal(result.passed, true, 'demo-preset-reset should pass');
  const snap = actor.getSnapshot();
  assert.strictEqual(snap.player?.hp, 240, 'Player HP should be restored to 240 after reset');
  assert.strictEqual(snap.target?.hp, 650, 'Target HP should be restored to 650 after reset');
  const events = actor.eventLog?.events ?? [];
  const resetEvs = events.filter((e) => String(e.type) === String(CombatEventType.Reset));
  assert.ok(resetEvs.length > 0, 'Reset event should have occurred');
  console.log('PASS scenario: demo-preset-reset');
}

console.log('demo battle scenario tests passed');
