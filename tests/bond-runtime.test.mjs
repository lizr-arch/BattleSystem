import assert from 'node:assert/strict';

import { BladeRuntime } from '../src/core/blade-runtime.js';
import { CombatEventType } from '../src/core/enums.js';
import { createBondState } from '../src/core/bond.js';

function createDummyTarget(hp = 999999) {
  return { x: 200, y: 200, radius: 38, hp, maxHp: hp, dead: false };
}

function createDummyActor(x = 100, y = 200) {
  return { x, y };
}

const defaultSpec = { startupFrames: 12, activeFrames: 2, recoveryFrames: 16, damage: 10, range: 190, cooldownFrames: 30 };

function tickUntilHit(blade, target, actor, maxTicks = 100) {
  for (let i = 0; i < maxTicks; i++) {
    const r = blade.tick({ target, actor });
    if (r.damageToApply) return r;
  }
  return null;
}

// Test 1: BladeRuntime.getSnapshot().bond default values
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const snap = blade.getSnapshot();
  assert.ok(snap.bond, 'bond should exist in snapshot');
  assert.strictEqual(snap.bond.trust, 0);
  assert.strictEqual(snap.bond.trustLevel, 1);
  assert.strictEqual(snap.bond.mood, 50);
  assert.strictEqual(snap.bond.sync, 0);
  console.log('PASS: getSnapshot().bond default values correct');
}

// Test 2: BladeRuntime with pre-existing bond
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      bond: { trust: 50, trustLevel: 1, mood: 60, sync: 10 },
    },
    autoAttackSpec: defaultSpec,
  });
  const snap = blade.getSnapshot();
  assert.strictEqual(snap.bond.trust, 50);
  assert.strictEqual(snap.bond.mood, 60);
  assert.strictEqual(snap.bond.sync, 10);
  console.log('PASS: pre-existing bond in resolvedBlade preserved');
}

// Test 3: BladeAttackHit returns BondSyncChanged event
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  assert.ok(result, 'should produce a hit');
  const syncEvent = result.events.find(e => e.type === CombatEventType.BondSyncChanged);
  assert.ok(syncEvent, 'BondSyncChanged event should exist');
  assert.strictEqual(syncEvent.data.reason, 'blade_hit');
  console.log('PASS: BladeAttackHit produces BondSyncChanged event');
}

// Test 4: BladeAttackHit increases sync by 15
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const syncEvent = result.events.find(e => e.type === CombatEventType.BondSyncChanged);
  assert.strictEqual(syncEvent.data.before, 0);
  assert.strictEqual(syncEvent.data.after, 15);
  assert.strictEqual(blade.bondState.sync, 15);
  console.log('PASS: sync increased by 15 on BladeAttackHit');
}

// Test 5: BladeAttackHit increases trust by 1
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const trustEvent = result.events.find(e => e.type === CombatEventType.BondTrustChanged);
  assert.ok(trustEvent, 'BondTrustChanged event should exist');
  assert.strictEqual(trustEvent.data.before, 0);
  assert.strictEqual(trustEvent.data.after, 1);
  assert.strictEqual(blade.bondState.trust, 1);
  console.log('PASS: trust increased by 1 on BladeAttackHit');
}

// Test 6: BladeAttackHit produces BondSyncTriggered when sync reaches 75
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  blade.bondState.sync = 70;
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const trigEvent = result.events.find(e => e.type === CombatEventType.BondSyncTriggered);
  assert.ok(trigEvent, 'BondSyncTriggered should exist when sync reaches 75');
  assert.strictEqual(trigEvent.data.syncThreshold, 75);
  assert.strictEqual(trigEvent.data.overflow, 10);
  assert.strictEqual(blade.bondState.sync, 0);
  console.log('PASS: BondSyncTriggered fires when sync >= 75');
}

// Test 7: Loyal Blade gains more trust (2 instead of 1)
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'LoyalBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Loyal',
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const trustEvent = result.events.find(e => e.type === CombatEventType.BondTrustChanged);
  assert.strictEqual(trustEvent.data.after, 2);
  assert.strictEqual(blade.bondState.trust, 2);
  console.log('PASS: Loyal Blade trust gain = 2 (vs default 1)');
}

// Test 8: Proud Blade gains more sync and less trust
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'ProudBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Proud',
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const syncEvent = result.events.find(e => e.type === CombatEventType.BondSyncChanged);
  assert.strictEqual(syncEvent.data.after, 18, 'Proud sync gain should be 18 (15*1.2)');
  const trustEvent = result.events.find(e => e.type === CombatEventType.BondTrustChanged);
  assert.strictEqual(trustEvent.data.after, 1, 'Proud trust gain should be 1 (1*0.8 rounded)');
  console.log('PASS: Proud Blade sync=18, trust=1');
}

// Test 9: _participated flag set on first hit
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  assert.strictEqual(blade._participated, false);
  const target = createDummyTarget();
  const actor = createDummyActor();
  tickUntilHit(blade, target, actor);
  assert.strictEqual(blade._participated, true);
  console.log('PASS: _participated set to true on first hit');
}

// Test 10: Bond events in tick() return alongside BladeAttackHit
{
  const blade = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'TestBlade',
      role: 'DPS',
      element: 'Neutral',
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  const result = tickUntilHit(blade, target, actor);
  const hasBladeHit = result.events.some(e => e.type === CombatEventType.BladeAttackHit);
  const hasBondTrust = result.events.some(e => e.type === CombatEventType.BondTrustChanged);
  const hasBondSync = result.events.some(e => e.type === CombatEventType.BondSyncChanged);
  assert.ok(hasBladeHit, 'BladeAttackHit should exist');
  assert.ok(hasBondTrust, 'BondTrustChanged should exist');
  assert.ok(hasBondSync, 'BondSyncChanged should exist');
  console.log('PASS: bond events returned alongside BladeAttackHit in tick()');
}
