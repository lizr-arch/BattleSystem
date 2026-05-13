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

// Scenario 1: bond-blade-hit-gains-sync
{
  const { result } = run('bond-blade-hit-gains-sync');
  assert.equal(result.passed, true, 'bond-blade-hit-gains-sync should pass');
  console.log('PASS scenario: bond-blade-hit-gains-sync');
}

// Scenario 2: bond-sync-triggered
{
  const { result } = run('bond-sync-triggered');
  assert.equal(result.passed, true, 'bond-sync-triggered should pass');
  console.log('PASS scenario: bond-sync-triggered');
}

// Scenario 3: bond-victory-gains-trust
{
  const { actor, result } = run('bond-victory-gains-trust');
  assert.equal(result.passed, true, 'bond-victory-gains-trust should pass');
  const events = actor.eventLog?.events ?? [];
  const victoryEvent = events.find((e) => String(e.type) === String(CombatEventType.BattleEnded) && e.data?.result === 'Victory');
  assert.ok(victoryEvent, 'BattleEnded Victory should exist');
  const trustEvent = events.find((e) => String(e.type) === String(CombatEventType.BondTrustChanged));
  assert.ok(trustEvent, 'BondTrustChanged should exist after Victory');
  const moodEvent = events.find((e) => String(e.type) === String(CombatEventType.BondMoodChanged) && e.data?.reason === 'victory');
  assert.ok(moodEvent, 'BondMoodChanged reason=victory should exist');
  console.log('PASS scenario: bond-victory-gains-trust (extra assertions)');
}

// Scenario 4: bond-defeat-lowers-mood
{
  const { actor, result } = run('bond-defeat-lowers-mood');
  assert.equal(result.passed, true, 'bond-defeat-lowers-mood should pass');
  const events = actor.eventLog?.events ?? [];
  const defeatEvent = events.find((e) => String(e.type) === String(CombatEventType.BattleEnded) && e.data?.result === 'Defeat');
  assert.ok(defeatEvent, 'BattleEnded Defeat should exist');
  const moodEvent = events.find((e) => String(e.type) === String(CombatEventType.BondMoodChanged) && e.data?.reason === 'defeat');
  assert.ok(moodEvent, 'BondMoodChanged reason=defeat should exist');
  assert.ok(moodEvent.data.after < moodEvent.data.before, 'Mood should decrease after defeat');
  const defeatFrame = defeatEvent.frame ?? 0;
  const postDefeatTrustEvent = events.some(
    (e) => String(e.type) === String(CombatEventType.BondTrustChanged) && e.data?.after > e.data?.before && e.frame >= defeatFrame
  );
  assert.equal(postDefeatTrustEvent, false, 'No trust increase event should occur at or after defeat frame');
  console.log('PASS scenario: bond-defeat-lowers-mood (extra assertions)');
}

// Scenario 5: bond-loyal-gains-more-trust
{
  const { actor, result } = run('bond-loyal-gains-more-trust');
  assert.equal(result.passed, true, 'bond-loyal-gains-more-trust should pass');
  const brs = actor.bladeRuntimes ?? [];
  assert.ok(brs.length >= 2, 'Should have 2 blade runtimes');
  const loyalBlade = brs.find((b) => b.resolvedBlade.individualTrait === 'Loyal');
  const normalBlade = brs.find((b) => b.resolvedBlade.individualTrait !== 'Loyal');
  assert.ok(loyalBlade, 'Loyal blade should exist');
  assert.ok(normalBlade, 'Normal blade should exist');
  if (loyalBlade._participated && normalBlade._participated) {
    assert.ok(loyalBlade.bondState.trust > normalBlade.bondState.trust, 'Loyal blade should have more trust');
  }
  console.log('PASS scenario: bond-loyal-gains-more-trust');
}

// Scenario 6: bond-proud-gains-more-sync-less-trust
{
  const { actor, result } = run('bond-proud-gains-more-sync-less-trust');
  assert.equal(result.passed, true, 'bond-proud-gains-more-sync-less-trust should pass');
  const brs = actor.bladeRuntimes ?? [];
  assert.ok(brs.length >= 1, 'Should have at least 1 blade runtime');
  const proudBlade = brs[0];
  assert.ok(proudBlade._participated, 'Proud blade should have participated');
  const events = actor.eventLog?.events ?? [];
  const syncEvent = events.find((e) => String(e.type) === String(CombatEventType.BondSyncChanged));
  assert.ok(syncEvent, 'BondSyncChanged should exist');
  assert.strictEqual(syncEvent.data.after, 18, 'Proud sync should be 18');
  console.log('PASS scenario: bond-proud-gains-more-sync-less-trust');
}

console.log('bond scenario tests passed');
