import assert from 'node:assert/strict';

import { CombatActor } from '../src/core/combat-actor.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';
import { EnemyStrikeSpec } from '../src/core/enemy-strike.js';
import { CombatEventType } from '../src/core/enums.js';
import { DEFAULT_BOND_CONFIG } from '../src/core/bond.js';
import { createDefaultActionSpecs, createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

function createActorWithBeastBlade(overrides = {}) {
  const specs = createDefaultActionSpecs();
  const actor = createDefaultCombatActor();
  actor.resetRuntime();
  actor.eventLog.clear();
  actor.autoAttackRange = 0;
  actor.target.x = 200;
  actor.target.y = 200;
  actor.target.hp = overrides.targetHp ?? 999999;
  actor.target.maxHp = overrides.targetMaxHp ?? actor.target.hp;
  actor.target.dead = false;
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.player.hp = overrides.playerHp ?? 999999;
  actor.player.maxHp = overrides.playerMaxHp ?? actor.player.hp;
  actor.player.dead = false;
  if (actor.battle) {
    actor.battle.active = true;
    actor.battle.result = null;
  }
  const grid = createBackpackGrid({ width: 9, height: 9 });
  grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
  const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  actor.resolvedLoadout = resolved;
  if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
  for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
  for (const blade of resolved.activeBlades) {
    actor.linkBlade(blade);
  }
  return actor;
}

function tickUntilBladeHit(actor, maxFrames = 120) {
  for (let i = 0; i < maxFrames; i++) {
    actor.tick(new CombatInputFrame());
    const events = actor.eventLog.events ?? [];
    if (events.some((e) => String(e.type) === String(CombatEventType.BladeAttackHit))) {
      return;
    }
  }
}

function findEvent(events, type, pred) {
  return events.find((e) => String(e.type) === String(type) && (!pred || pred(e)));
}

function hasEvent(events, type, pred) {
  return events.some((e) => String(e.type) === String(type) && (!pred || pred(e)));
}

// Test 1: Trust survives resetRuntime
{
  const actor = createActorWithBeastBlade();
  tickUntilBladeHit(actor);
  const br = actor.bladeRuntimes?.[0];
  assert.ok(br, 'blade runtime should exist');
  const trustBefore = br.bondState.trust;
  assert.ok(trustBefore > 0, 'trust should be > 0 after blade hit');

  actor.resetRuntime();
  const brAfter = actor.bladeRuntimes?.[0];
  assert.ok(brAfter, 'blade runtime should exist after reset');
  assert.strictEqual(brAfter.bondState.trust, trustBefore, 'trust should survive resetRuntime');
  assert.ok(brAfter.bondState.trustLevel >= 1, 'trustLevel should be valid');
  console.log('PASS: Trust survives resetRuntime');
}

// Test 2: Sync clears on resetRuntime
{
  const actor = createActorWithBeastBlade();
  tickUntilBladeHit(actor);
  const br = actor.bladeRuntimes?.[0];
  assert.ok(br, 'blade runtime should exist');
  assert.ok(br.bondState.sync > 0, 'sync should be > 0 after blade hit');

  actor.resetRuntime();
  const brAfter = actor.bladeRuntimes?.[0];
  assert.strictEqual(brAfter.bondState.sync, 0, 'sync should be 0 after resetRuntime');
  console.log('PASS: Sync clears on resetRuntime');
}

// Test 3: Mood resets to 50 on resetRuntime
{
  const actor = createActorWithBeastBlade();
  tickUntilBladeHit(actor);
  const br = actor.bladeRuntimes?.[0];
  assert.ok(br, 'blade runtime should exist');
  br.bondState.mood = 30;

  actor.resetRuntime();
  const brAfter = actor.bladeRuntimes?.[0];
  assert.strictEqual(brAfter.bondState.mood, 50, 'mood should reset to 50 after resetRuntime');
  console.log('PASS: Mood resets to 50 on resetRuntime');
}

// Test 4: Victory commit preserves Trust before reset
{
  const actor = createActorWithBeastBlade({ targetHp: 10 });
  tickUntilBladeHit(actor);

  const events = actor.eventLog.events ?? [];
  const victoryEvent = events.find((e) => String(e.type) === String(CombatEventType.BattleEnded) && e.data?.result === 'Victory');
  assert.ok(victoryEvent, 'Victory should have occurred');

  const trustEvent = events.find((e) => String(e.type) === String(CombatEventType.BondTrustChanged));
  assert.ok(trustEvent, 'BondTrustChanged should exist');
  assert.ok(trustEvent.data.after > trustEvent.data.before, 'trust should have increased');

  const blade = actor.resolvedLoadout?.activeBlades?.[0];
  assert.ok(blade, 'activeBlade should exist');
  assert.ok(blade.bond, 'activeBlade should have bond');
  assert.ok(blade.bond.trust > 0, 'activeBlade.bond.trust should be > 0 after Victory commit');

  const br = actor.bladeRuntimes?.[0];
  assert.ok(br, 'blade runtime should exist');
  assert.strictEqual(br.bondState.trust, blade.bond.trust, 'runtime trust should match activeBlade bond trust');
  console.log('PASS: Victory commit preserves Trust before reset');
}

// Test 5: Defeat lowers Mood but does not lower Trust
{
  const actor = createActorWithBeastBlade({ playerHp: 20, playerMaxHp: 20 });
  tickUntilBladeHit(actor);
  actor.eventLog.clear();

  const br = actor.bladeRuntimes?.[0];
  assert.ok(br, 'blade runtime should exist');
  const trustBeforeDefeat = br.bondState.trust;
  assert.ok(trustBeforeDefeat > 0, 'trust should be > 0 before defeat');

  const config = DEFAULT_BOND_CONFIG;
  const moodBeforeDefeat = br.bondState.mood;

  if (actor.enemy) {
    actor.enemy.cooldownLeft = 0;
    actor.enemy.state = 'Idle';
  }

  for (let i = 0; i < 300; i++) {
    actor.tick(new CombatInputFrame());
    const events = actor.eventLog.events ?? [];
    if (hasEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat')) {
      break;
    }
  }

  const events = actor.eventLog.events ?? [];
  const defeatEvent = findEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat');
  assert.ok(defeatEvent, 'Defeat should have occurred');

  const moodDownEvent = findEvent(events, CombatEventType.BondMoodChanged, (e) => e.data?.reason === 'defeat');
  assert.ok(moodDownEvent, 'BondMoodChanged reason=defeat should exist');
  assert.ok(moodDownEvent.data.after < moodDownEvent.data.before, 'mood should decrease on defeat');

  const brAfterDefeat = actor.bladeRuntimes?.[0];
  const trustAfterDefeat = brAfterDefeat?.bondState?.trust ?? trustBeforeDefeat;
  assert.ok(trustAfterDefeat >= trustBeforeDefeat, 'trust should NOT decrease on defeat (may increase from blade hits)');

  const moodAfterDefeat = brAfterDefeat?.bondState?.mood ?? moodBeforeDefeat;
  assert.ok(moodAfterDefeat < moodBeforeDefeat, 'mood should be lower after defeat');

  actor.resetRuntime();
  const brAfterReset = actor.bladeRuntimes?.[0];
  assert.ok(brAfterReset.bondState.trust >= trustBeforeDefeat, 'trust should survive reset after defeat');
  assert.strictEqual(brAfterReset.bondState.mood, 50, 'mood should reset to 50');
  console.log('PASS: Defeat lowers Mood but does not lower Trust');
}

// Test 6: V5.4 existing bond scenarios still PASS
function runV54Scenarios() {
  const scenarioNames = [
    'bond-blade-hit-gains-sync',
    'bond-sync-triggered',
    'bond-victory-gains-trust',
    'bond-defeat-lowers-mood',
    'bond-loyal-gains-more-trust',
    'bond-proud-gains-more-sync-less-trust',
  ];
  for (const name of scenarioNames) {
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
    assert.equal(result.passed, true, `${name} should pass`);
  }
  console.log('PASS: All 6 V5.4 bond scenarios still pass');
}
runV54Scenarios();

// Test 7-9: New bond reset scenarios
function runScenarioCheck(name) {
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

{
  const { result } = runScenarioCheck('bond-reset-keeps-trust');
  assert.equal(result.passed, true, 'bond-reset-keeps-trust should pass');
  console.log('PASS scenario: bond-reset-keeps-trust');
}

{
  const { result } = runScenarioCheck('bond-reset-clears-sync');
  assert.equal(result.passed, true, 'bond-reset-clears-sync should pass');
  console.log('PASS scenario: bond-reset-clears-sync');
}

{
  const { result } = runScenarioCheck('bond-reset-normalizes-mood');
  assert.equal(result.passed, true, 'bond-reset-normalizes-mood should pass');
  console.log('PASS scenario: bond-reset-normalizes-mood');
}

console.log('bond persistence tests passed');
