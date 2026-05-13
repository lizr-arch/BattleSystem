import assert from 'node:assert/strict';

import {
  createBondState,
  cloneBondState,
  recalcTrustLevel,
  clampBondValues,
  applyTrustGain,
  applyMoodChange,
  applySyncGain,
  computeBondModifiers,
  DEFAULT_BOND_CONFIG,
  TRUST_THRESHOLDS,
} from '../src/core/bond.js';

// Test 1: Default BondState
{
  const bs = createBondState();
  assert.strictEqual(bs.trust, 0);
  assert.strictEqual(bs.trustLevel, 1);
  assert.strictEqual(bs.mood, 50);
  assert.strictEqual(bs.sync, 0);
  console.log('PASS: BondState default values correct');
}

// Test 2: BondState with overrides
{
  const bs = createBondState({ trust: 50, mood: 60 });
  assert.strictEqual(bs.trust, 50);
  assert.strictEqual(bs.trustLevel, 1);
  assert.strictEqual(bs.mood, 60);
  assert.strictEqual(bs.sync, 0);
  console.log('PASS: BondState override creation works');
}

// Test 3: Trust level calculation
{
  assert.strictEqual(recalcTrustLevel(0), 1);
  assert.strictEqual(recalcTrustLevel(99), 1);
  assert.strictEqual(recalcTrustLevel(100), 2);
  assert.strictEqual(recalcTrustLevel(249), 2);
  assert.strictEqual(recalcTrustLevel(250), 3);
  assert.strictEqual(recalcTrustLevel(499), 3);
  assert.strictEqual(recalcTrustLevel(500), 4);
  assert.strictEqual(recalcTrustLevel(899), 4);
  assert.strictEqual(recalcTrustLevel(900), 5);
  assert.strictEqual(recalcTrustLevel(1000), 5);
  console.log('PASS: Trust level thresholds correct');
}

// Test 4: Mood clamping
{
  const high = createBondState({ mood: 150 });
  clampBondValues(high);
  assert.strictEqual(high.mood, 100);
  const low = createBondState({ mood: -10 });
  clampBondValues(low);
  assert.strictEqual(low.mood, 0);
  console.log('PASS: Mood clamping 0-100');
}

// Test 5: Sync clamping
{
  const high = createBondState({ sync: 150 });
  clampBondValues(high);
  assert.strictEqual(high.sync, 100);
  const low = createBondState({ sync: -5 });
  clampBondValues(low);
  assert.strictEqual(low.sync, 0);
  console.log('PASS: Sync clamping 0-100');
}

// Test 6: cloneBondState produces independent copy
{
  const orig = createBondState({ trust: 10, mood: 55, sync: 3 });
  const cloned = cloneBondState(orig);
  assert.strictEqual(cloned.trust, 10);
  assert.strictEqual(cloned.mood, 55);
  assert.strictEqual(cloned.sync, 3);
  orig.trust = 999;
  orig.mood = 999;
  orig.sync = 999;
  assert.strictEqual(cloned.trust, 10);
  assert.strictEqual(cloned.mood, 55);
  assert.strictEqual(cloned.sync, 3);
  console.log('PASS: cloneBondState produces independent copy');
}

// Test 7: applyTrustGain
{
  const bs = createBondState();
  const r1 = applyTrustGain(bs, 10);
  assert.strictEqual(r1.before, 0);
  assert.strictEqual(r1.after, 10);
  assert.strictEqual(r1.beforeLevel, 1);
  assert.strictEqual(r1.afterLevel, 1);
  assert.strictEqual(bs.trust, 10);
  const r2 = applyTrustGain(bs, 95);
  assert.strictEqual(r2.before, 10);
  assert.strictEqual(r2.after, 105);
  assert.strictEqual(r2.beforeLevel, 1);
  assert.strictEqual(r2.afterLevel, 2);
  assert.strictEqual(bs.trust, 105);
  assert.strictEqual(bs.trustLevel, 2);
  console.log('PASS: applyTrustGain works correctly');
}

// Test 8: applyMoodChange
{
  const bs = createBondState();
  const r1 = applyMoodChange(bs, 20, 'test');
  assert.strictEqual(r1.before, 50);
  assert.strictEqual(r1.after, 70);
  assert.strictEqual(r1.reason, 'test');
  const r2 = applyMoodChange(bs, -80, 'test');
  assert.strictEqual(r2.before, 70);
  assert.strictEqual(r2.after, 0);
  assert.strictEqual(bs.mood, 0);
  console.log('PASS: applyMoodChange works with clamping');
}

// Test 9: applySyncGain without threshold
{
  const bs = createBondState();
  const { gainResult, triggeredResults } = applySyncGain(bs, 14, 'blade_hit', DEFAULT_BOND_CONFIG);
  assert.strictEqual(gainResult.before, 0);
  assert.strictEqual(gainResult.after, 14);
  assert.strictEqual(gainResult.reason, 'blade_hit');
  assert.strictEqual(triggeredResults.length, 0);
  assert.strictEqual(bs.sync, 14);
  console.log('PASS: applySyncGain without threshold works');
}

// Test 10: applySyncGain with threshold trigger
{
  const bs = createBondState({ sync: 70 });
  const { gainResult, triggeredResults } = applySyncGain(bs, 10, 'blade_hit', DEFAULT_BOND_CONFIG);
  assert.strictEqual(gainResult.before, 70);
  assert.strictEqual(gainResult.after, 80);
  assert.strictEqual(triggeredResults.length, 1);
  assert.strictEqual(triggeredResults[0].threshold, 75);
  assert.strictEqual(triggeredResults[0].overflow, 5);
  assert.strictEqual(bs.sync, 0);
  console.log('PASS: applySyncGain with threshold trigger works');
}

// Test 11: computeBondModifiers for Loyal
{
  const mods = computeBondModifiers({ individualTrait: 'Loyal' });
  assert.strictEqual(mods.trustMultiplier, 2);
  assert.strictEqual(mods.syncMultiplier, 1);
  assert.strictEqual(mods.extraTrustOnVictory, 5);
  console.log('PASS: Loyal modifiers correct');
}

// Test 12: computeBondModifiers for Proud
{
  const mods = computeBondModifiers({ individualTrait: 'Proud' });
  assert.strictEqual(mods.trustMultiplier, 0.8);
  assert.strictEqual(mods.syncMultiplier, 1.2);
  assert.strictEqual(mods.extraTrustOnVictory, 0);
  console.log('PASS: Proud modifiers correct');
}

// Test 13: computeBondModifiers for null trait
{
  const mods = computeBondModifiers({ individualTrait: null });
  assert.strictEqual(mods.trustMultiplier, 1);
  assert.strictEqual(mods.syncMultiplier, 1);
  assert.strictEqual(mods.extraTrustOnVictory, 0);
  console.log('PASS: Null trait modifiers are neutral');
}

// Test 14: computeBondModifiers for Fierce (no bond effect)
{
  const mods = computeBondModifiers({ individualTrait: 'Fierce' });
  assert.strictEqual(mods.trustMultiplier, 1);
  assert.strictEqual(mods.syncMultiplier, 1);
  console.log('PASS: Fierce trait has no bond modifier effect');
}

// Test 15: DEFAULT_BOND_CONFIG values
{
  assert.strictEqual(DEFAULT_BOND_CONFIG.trustOnVictory, 10);
  assert.strictEqual(DEFAULT_BOND_CONFIG.trustOnBladeHit, 1);
  assert.strictEqual(DEFAULT_BOND_CONFIG.moodOnVictory, 5);
  assert.strictEqual(DEFAULT_BOND_CONFIG.moodOnDefeat, -10);
  assert.strictEqual(DEFAULT_BOND_CONFIG.syncOnBladeHit, 15);
  assert.strictEqual(DEFAULT_BOND_CONFIG.syncThreshold, 75);
  console.log('PASS: DEFAULT_BOND_CONFIG values correct');
}

// Test 16: Trust gain with Loyal multiplier
{
  const bs = createBondState();
  const mods = computeBondModifiers({ individualTrait: 'Loyal' });
  const amount = Math.round(1 * mods.trustMultiplier);
  assert.strictEqual(amount, 2);
  const result = applyTrustGain(bs, amount);
  assert.strictEqual(result.before, 0);
  assert.strictEqual(result.after, 2);
  console.log('PASS: Loyal trust multiplier applies correctly');
}
