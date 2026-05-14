import assert from 'node:assert/strict';

import { createDemoBattlePreset, resetDemoPreset, TRAINING_BRUTE_SPEC, DEMO_PLAYER_SPEC } from '../src/dev/demo-battle-preset.js';
import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatEventType } from '../src/core/enums.js';

function createActor() {
  const actor = createDemoBattlePreset({
    createActor: ({ target, enemyStrike, playerHp, playerMaxHp, position, resolvedLoadout }) => {
      const a = createDefaultCombatActor();
      a.target = target;
      a.player.hp = playerHp;
      a.player.maxHp = playerMaxHp;
      a.x = position.x;
      a.y = position.y;
      a.resolvedLoadout = resolvedLoadout;
      if (a.enemy) a.enemy.strike = enemyStrike;
      a.refreshBladeUnlocks?.();
      return a;
    },
  });
  return actor;
}

// Test 1: createDemoBattlePreset produces correct player HP
{
  const actor = createActor();
  assert.strictEqual(actor.player.hp, DEMO_PLAYER_SPEC.hp, 'Player HP should match preset');
  assert.strictEqual(actor.player.maxHp, DEMO_PLAYER_SPEC.maxHp, 'Player maxHp should match preset');
  console.log('PASS: createDemoBattlePreset sets player HP correctly');
}

// Test 2: createDemoBattlePreset produces correct target
{
  const actor = createActor();
  assert.ok(actor.target, 'Target should exist');
  assert.strictEqual(actor.target.hp, TRAINING_BRUTE_SPEC.hp, 'Target HP should match Training Brute spec');
  assert.strictEqual(actor.target.maxHp, TRAINING_BRUTE_SPEC.maxHp, 'Target maxHp should match');
  console.log('PASS: createDemoBattlePreset sets target correctly');
}

// Test 3: createDemoBattlePreset creates 2 active blades
{
  const actor = createActor();
  const blades = actor.resolvedLoadout?.activeBlades ?? [];
  assert.ok(blades.length >= 2, `Expected at least 2 active blades, got ${blades.length}`);
  const ids = blades.map((b) => b.itemId ?? b.bladeId);
  assert.ok(ids.includes('GreyWolfBlade'), 'GreyWolfBlade should be active');
  assert.ok(ids.includes('BrownBearBlade'), 'BrownBearBlade should be active');
  console.log('PASS: createDemoBattlePreset has GreyWolf + BrownBear active');
}

// Test 4: createDemoBattlePreset sets bond trustLevel >= 3 on all blades
{
  const actor = createActor();
  const blades = actor.resolvedLoadout?.activeBlades ?? [];
  for (const blade of blades) {
    const tl = blade.bond?.trustLevel ?? 0;
    assert.ok(tl >= 3, `Blade ${blade.itemId ?? blade.bladeId} trustLevel should be >= 3, got ${tl}`);
  }
  console.log('PASS: createDemoBattlePreset sets trustLevel >= 3 on all blades');
}

// Test 5: createDemoBattlePreset sets enemy strike
{
  const actor = createActor();
  assert.ok(actor.enemy?.strike, 'Enemy strike should be configured');
  assert.strictEqual(actor.enemy.strike.damage, TRAINING_BRUTE_SPEC.strike.damage, 'Enemy strike damage should match spec');
  console.log('PASS: createDemoBattlePreset configures enemy strike');
}

// Test 6: resetDemoPreset restores HP to default values
{
  const actor = createActor();
  actor.player.hp = 1;
  actor.player.dead = false;
  actor.target.hp = 1;
  actor.target.dead = false;
  actor.enemy.cooldownLeft = 99;
  if (actor.battle) {
    actor.battle.active = true;
    actor.battle.result = null;
  }

  resetDemoPreset(actor);

  assert.strictEqual(actor.player.hp, DEMO_PLAYER_SPEC.hp, 'Player HP should be restored after reset');
  assert.strictEqual(actor.target.hp, TRAINING_BRUTE_SPEC.hp, 'Target HP should be restored after reset');
  assert.strictEqual(actor.player.dead, false, 'Player should not be dead after reset');
  assert.strictEqual(actor.target.dead, false, 'Target should not be dead after reset');
  if (actor.enemy) assert.strictEqual(actor.enemy.cooldownLeft, 0, 'Enemy cooldown should reset to 0');
  console.log('PASS: resetDemoPreset restores HP and state');
}

// Test 7: resetDemoPreset preserves blade setup
{
  const actor = createActor();
  actor.player.hp = 1;
  actor.target.hp = 1;

  resetDemoPreset(actor);

  const blades = actor.resolvedLoadout?.activeBlades ?? [];
  assert.ok(blades.length >= 2, 'Should still have 2 active blades after reset');
  console.log('PASS: resetDemoPreset preserves blade loadout');
}

// Test 8: resetDemoPreset emits Reset event
{
  const actor = createActor();
  actor.eventLog.clear();

  resetDemoPreset(actor);

  const events = actor.eventLog?.events ?? [];
  const resetEv = events.find((e) => String(e.type) === String(CombatEventType.Reset));
  assert.ok(resetEv, 'Reset event should be emitted');
  console.log('PASS: resetDemoPreset emits Reset event');
}

console.log('demo battle preset tests passed');
