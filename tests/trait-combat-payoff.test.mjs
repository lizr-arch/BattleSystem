import assert from 'node:assert/strict';

import { hasCombatSlot, resolveTraitCombatPayoff, resolveLoyalGuard } from '../src/core/trait-combat-payoff.js';
import { formatCombatEvent, emitCombatEvent } from '../src/core/combat-events.js';
import { CombatEventLog } from '../src/core/combat-event-log.js';
import { CombatEventType } from '../src/core/enums.js';
import { resolveCombatUnlocks } from '../src/core/combat-unlocks.js';
import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';
import { BladeRuntime } from '../src/core/blade-runtime.js';
import { createBondState } from '../src/core/bond.js';

// Test 1: hasCombatSlot() returns true for BondCombatSlot1
{
  const blade = { unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] } };
  assert.strictEqual(hasCombatSlot(blade, 'BondCombatSlot1'), true);
  console.log('PASS: hasCombatSlot returns true for BondCombatSlot1');
}

// Test 2: hasCombatSlot() returns false for empty slots
{
  const blade = { unlocks: { combatSlots: [], traitBoosts: [] } };
  assert.strictEqual(hasCombatSlot(blade, 'BondCombatSlot1'), false);
  console.log('PASS: hasCombatSlot returns false for empty slots');
}

// Test 3: hasCombatSlot() returns false for missing unlocks
{
  const blade = {};
  assert.strictEqual(hasCombatSlot(blade, 'BondCombatSlot1'), false);
  console.log('PASS: hasCombatSlot returns false for missing unlocks');
}

// Test 4: hasCombatSlot() works with BladeRuntime
{
  const runtime = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  assert.strictEqual(hasCombatSlot(runtime, 'BondCombatSlot1'), true);
  console.log('PASS: hasCombatSlot works with BladeRuntime');
}

// Test 5: resolveTraitCombatPayoff Fierce + slot => FierceFollowUp
{
  const result = resolveTraitCombatPayoff({
    trait: 'Fierce',
    unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    context: 'blade_hit',
    baseAmount: 24,
  });
  assert.ok(result, 'should produce payoff');
  assert.strictEqual(result.payoffId, 'FierceFollowUp');
  assert.strictEqual(result.damage, Math.round(24 * 0.15));
  console.log('PASS: resolveTraitCombatPayoff Fierce + slot => FierceFollowUp');
}

// Test 6: resolveTraitCombatPayoff Fierce no slot => null
{
  const result = resolveTraitCombatPayoff({
    trait: 'Fierce',
    unlocks: { combatSlots: [], traitBoosts: [] },
    context: 'blade_hit',
    baseAmount: 24,
  });
  assert.strictEqual(result, null);
  console.log('PASS: resolveTraitCombatPayoff Fierce no slot => null');
}

// Test 7: resolveTraitCombatPayoff null trait => null
{
  const result = resolveTraitCombatPayoff({
    trait: null,
    unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    context: 'blade_hit',
    baseAmount: 24,
  });
  assert.strictEqual(result, null);
  console.log('PASS: resolveTraitCombatPayoff null trait => null');
}

// Test 8: resolveTraitCombatPayoff Proud + slot + sync_triggered => ProudSyncStrike
{
  const result = resolveTraitCombatPayoff({
    trait: 'Proud',
    unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    context: 'sync_triggered',
    baseAmount: 30,
  });
  assert.ok(result, 'should produce payoff');
  assert.strictEqual(result.payoffId, 'ProudSyncStrike');
  assert.strictEqual(result.damage, Math.round(30 * 0.10));
  console.log('PASS: resolveTraitCombatPayoff Proud + slot => ProudSyncStrike');
}

// Test 9: resolveTraitCombatPayoff Proud no slot => null
{
  const result = resolveTraitCombatPayoff({
    trait: 'Proud',
    unlocks: { combatSlots: [], traitBoosts: [] },
    context: 'sync_triggered',
    baseAmount: 30,
  });
  assert.strictEqual(result, null);
  console.log('PASS: resolveTraitCombatPayoff Proud no slot => null');
}

// Test 10: resolveLoyalGuard with active Loyal Blade reduces damage
{
  const loyalRuntime = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'l1',
      bladeId: 'BrownBearBlade',
      role: 'Tank',
      element: 'Neutral',
      individualTrait: 'Loyal',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  const result = resolveLoyalGuard({ bladeRuntimes: [loyalRuntime], incomingDamage: 100 });
  assert.strictEqual(result.finalDamage, Math.round(100 * 0.85));
  assert.strictEqual(result.events.length, 1);
  assert.strictEqual(result.events[0].type, 'TraitPayoffActivated');
  assert.strictEqual(result.events[0].data.payoffId, 'LoyalGuard');
  assert.strictEqual(result.events[0].data.beforeAmount, 100);
  assert.strictEqual(result.events[0].data.afterAmount, 85);
  console.log('PASS: resolveLoyalGuard with active Loyal Blade reduces damage');
}

// Test 11: resolveLoyalGuard Loyal Blade without combat slot => no reduction
{
  const loyalRuntime = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'l1',
      bladeId: 'BrownBearBlade',
      role: 'Tank',
      element: 'Neutral',
      individualTrait: 'Loyal',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      unlocks: { combatSlots: [], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  const result = resolveLoyalGuard({ bladeRuntimes: [loyalRuntime], incomingDamage: 100 });
  assert.strictEqual(result.finalDamage, 100);
  assert.strictEqual(result.events.length, 0);
  console.log('PASS: resolveLoyalGuard Loyal Blade without combat slot => no reduction');
}

// Test 12: resolveLoyalGuard with no blades => no reduction
{
  const result = resolveLoyalGuard({ bladeRuntimes: [], incomingDamage: 100 });
  assert.strictEqual(result.finalDamage, 100);
  assert.strictEqual(result.events.length, 0);
  console.log('PASS: resolveLoyalGuard with no blades => no reduction');
}

// Test 13: resolveLoyalGuard only first matching Loyal Blade (no stacking)
{
  const loyal1 = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'l1',
      bladeId: 'BrownBearBlade',
      role: 'Tank',
      element: 'Neutral',
      individualTrait: 'Loyal',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  const loyal2 = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'l2',
      bladeId: 'BrownBearBlade',
      role: 'Tank',
      element: 'Neutral',
      individualTrait: 'Loyal',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      unlocks: { combatSlots: ['BondCombatSlot1'], traitBoosts: [] },
    },
    autoAttackSpec: { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 },
  });
  const result = resolveLoyalGuard({ bladeRuntimes: [loyal1, loyal2], incomingDamage: 100 });
  assert.strictEqual(result.finalDamage, Math.round(100 * 0.85));
  assert.strictEqual(result.events.length, 1, 'only one event, no stacking');
  console.log('PASS: resolveLoyalGuard only first matching Loyal Blade (no stacking)');
}

// Test 14: TraitPayoffActivated event format exists in combat-events
{
  const eventLog = new CombatEventLog();
  emitCombatEvent(eventLog, 1, CombatEventType.TraitPayoffActivated, {
    bladeId: 'b1',
    trait: 'Fierce',
    payoffId: 'FierceFollowUp',
    amount: 5,
  });
  const formatted = formatCombatEvent(CombatEventType.TraitPayoffActivated, {
    trait: 'Fierce',
    payoffId: 'FierceFollowUp',
    amount: 5,
  });
  assert.ok(formatted.includes('TraitPayoffActivated'), 'format should include event name');
  assert.ok(formatted.includes('FierceFollowUp'), 'format should include payoffId');
  assert.ok(formatted.includes('amount=5'), 'format should include amount');
  console.log('PASS: TraitPayoffActivated event format exists');
}

// Test 15: TraitPayoffActivated event format for LoyalGuard
{
  const formatted = formatCombatEvent(CombatEventType.TraitPayoffActivated, {
    trait: 'Loyal',
    payoffId: 'LoyalGuard',
    beforeAmount: 15,
    afterAmount: 13,
    reducedAmount: 2,
  });
  assert.ok(formatted.includes('LoyalGuard'));
  assert.ok(formatted.includes('15->13'));
  console.log('PASS: TraitPayoffActivated LoyalGuard format');
}

console.log('trait combat payoff tests passed');
