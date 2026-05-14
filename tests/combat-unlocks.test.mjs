import assert from 'node:assert/strict';

import { resolveCombatUnlocks } from '../src/core/combat-unlocks.js';
import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';
import { BladeRuntime } from '../src/core/blade-runtime.js';

// Test 1: null bond → empty combatSlots
{
  const result = resolveCombatUnlocks({ bond: null });
  assert.deepStrictEqual(result.combatSlots, []);
  assert.deepStrictEqual(result.traitBoosts, []);
  console.log('PASS: null bond → empty combatSlots');
}

// Test 2: trustLevel=1 → empty combatSlots
{
  const result = resolveCombatUnlocks({ bond: { trustLevel: 1 } });
  assert.deepStrictEqual(result.combatSlots, []);
  console.log('PASS: trustLevel=1 → empty combatSlots');
}

// Test 3: trustLevel=2 → empty combatSlots
{
  const result = resolveCombatUnlocks({ bond: { trustLevel: 2 } });
  assert.deepStrictEqual(result.combatSlots, []);
  console.log('PASS: trustLevel=2 → empty combatSlots');
}

// Test 4: trustLevel=3 → BondCombatSlot1
{
  const result = resolveCombatUnlocks({ bond: { trustLevel: 3 } });
  assert.deepStrictEqual(result.combatSlots, ['BondCombatSlot1']);
  console.log('PASS: trustLevel=3 → BondCombatSlot1');
}

// Test 5: trustLevel=5 → BondCombatSlot1
{
  const result = resolveCombatUnlocks({ bond: { trustLevel: 5 } });
  assert.deepStrictEqual(result.combatSlots, ['BondCombatSlot1']);
  console.log('PASS: trustLevel=5 → BondCombatSlot1');
}

// Test 6: resolvedBlade always has unlocks field
{
  const grid = createBackpackGrid({ width: 9, height: 9 });
  grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
  const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  const blade = resolved.activeBlades[0];
  assert.ok(blade, 'activeBlade should exist');
  assert.ok(blade.unlocks, 'unlocks should exist');
  assert.ok(Array.isArray(blade.unlocks.combatSlots), 'combatSlots should be array');
  assert.ok(Array.isArray(blade.unlocks.traitBoosts), 'traitBoosts should be array');
  assert.deepStrictEqual(blade.unlocks.combatSlots, [], 'default unlocks should be empty');
  console.log('PASS: resolvedBlade always has unlocks field');
}

// Test 7: BladeRuntime snapshot includes unlocks
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      bond: { trust: 250, trustLevel: 3 },
      unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  const snap = blade.getSnapshot();
  assert.ok(snap.unlocks, 'snapshot should have unlocks');
  assert.deepStrictEqual(snap.unlocks.combatSlots, ['BondCombatSlot1']);
  assert.deepStrictEqual(snap.unlocks.traitBoosts, []);
  console.log('PASS: BladeRuntime snapshot includes unlocks');
}

console.log('combat unlocks tests passed');
