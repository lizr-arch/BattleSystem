import assert from 'node:assert/strict';

import { BladeRuntime } from '../src/core/blade-runtime.js';
import { CombatEventType } from '../src/core/enums.js';

function createDummyTarget(hp = 999999) {
  return { x: 200, y: 200, radius: 38, hp, maxHp: hp, dead: false };
}

function createDummyActor(x = 100, y = 200) {
  return { x, y };
}

const defaultSpec = { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 45 };

// Test 1: damageMultiplier 影响 BladeAttackHit 伤害
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'GreyWolfBlade',
      role: 'DPS',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1.3, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) { hitResult = r; break; }
  }
  assert.ok(hitResult, 'should produce a hit');
  const expectedDmg = Math.round(24 * 1.3 * 1.0);
  assert.strictEqual(hitResult.damageToApply.amount, expectedDmg);
  console.log('PASS: damageMultiplier 1.3 produces damage=' + expectedDmg + ' (vs base 24)');
}

// Test 2: cooldownMultiplier 影响冷却时间
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'BearBlade',
      role: 'Tank',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1.8, skillBudget: 0 },
    },
    autoAttackSpec: { startupFrames: 1, activeFrames: 1, recoveryFrames: 1, damage: 1, range: 190, cooldownFrames: 10 },
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  b.tick({ target, actor });
  b.tick({ target, actor });
  assert.strictEqual(b.state, 'Cooldown');
  assert.strictEqual(b.cooldownLeft, Math.round(10 * 1.8), 'cooldown should be 18 (=10*1.8)');
  console.log('PASS: cooldownMultiplier 1.8 makes cooldown ' + b.cooldownLeft + ' (base 10)');
}

// Test 3: Fierce trait 增加伤害
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'GreyWolfBlade',
      role: 'DPS',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1.0, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Fierce',
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) { hitResult = r; break; }
  }
  assert.ok(hitResult, 'should produce a hit');
  assert.strictEqual(hitResult.damageToApply.amount, Math.round(24 * 1.1));
  console.log('PASS: Fierce trait increases damage by 1.1x');
}

// Test 4: Fierce trait 触发 BladeTraitActivated 事件
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'GreyWolfBlade',
      role: 'DPS',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1.0, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Fierce',
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) { hitResult = r; break; }
  }
  const traitEvent = (hitResult?.events ?? []).find((e) => e.type === CombatEventType.BladeTraitActivated);
  assert.ok(traitEvent, 'should emit BladeTraitActivated for Fierce');
  assert.strictEqual(traitEvent.data.trait, 'Fierce');
  assert.strictEqual(traitEvent.data.effect, 'damage_multiplier');
  console.log('PASS: BladeTraitActivated event emitted for Fierce trait');
}

// Test 5: 无 hiddenProfile 时使用默认值（不崩溃，伤害不变）
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0.1,
    },
    autoAttackSpec: defaultSpec,
  });
  assert.strictEqual(b.state, 'Idle');
  const snap = b.getSnapshot();
  assert.strictEqual(snap.hiddenProfile.damageMultiplier, 1);
  assert.strictEqual(snap.hiddenProfile.cooldownMultiplier, 1);

  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) { hitResult = r; break; }
  }
  assert.strictEqual(hitResult.damageToApply.amount, Math.round(24 * 1.1));
  console.log('PASS: BladeRuntime with no hiddenProfile uses defaults (no crash, same damage)');
}

// Test 6: getSnapshot 包含 species/lineage/rarity/trait/hiddenProfile/lifeSkills
{
  const lifeSkillsSample = [{ tag: 'Tracking', level: 2 }];
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'GreyWolfBlade',
      role: 'DPS',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 0.9, damageMultiplier: 1.3, speedMultiplier: 1.4, cooldownMultiplier: 0.9, skillBudget: 6 },
      individualTrait: 'Fierce',
      species: 'Wolf',
      lineage: 'GreyWolf',
      rarity: 'Common',
      lifeSkills: lifeSkillsSample,
    },
    autoAttackSpec: defaultSpec,
  });
  const snap = b.getSnapshot();
  assert.strictEqual(snap.species, 'Wolf');
  assert.strictEqual(snap.lineage, 'GreyWolf');
  assert.strictEqual(snap.rarity, 'Common');
  assert.strictEqual(snap.individualTrait, 'Fierce');
  assert.strictEqual(snap.hiddenProfile.damageMultiplier, 1.3);
  assert.strictEqual(snap.lifeSkills.length, 1);
  assert.strictEqual(snap.lifeSkills[0].tag, 'Tracking');
  console.log('PASS: getSnapshot includes beast blade fields');
}

// Test 7: Fierce trait 只在首次命中触发一次事件（不重复）
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'GreyWolfBlade',
      role: 'DPS',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Fierce',
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 10, range: 190, cooldownFrames: 45 },
  });
  const target = createDummyTarget();
  const actor = createDummyActor();

  let allEvents = [];
  b.tick({ target, actor });
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    allEvents = allEvents.concat(r.events ?? []);
    if (r.damageToApply) break;
  }

  let traitCount1 = 0;
  for (const ev of allEvents) {
    if (ev.type === CombatEventType.BladeTraitActivated) traitCount1++;
  }
  assert.strictEqual(traitCount1, 1, 'first attack cycle should emit BladeTraitActivated exactly once');

  for (let i = 0; i < 100; i++) {
    b.tick({ target, actor });
    if (b.state === 'Idle') break;
  }
  b.tick({ target, actor });
  let allEvents2 = [];
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    allEvents2 = allEvents2.concat(r.events ?? []);
    if (r.damageToApply) break;
  }
  let traitCount2 = 0;
  for (const ev of allEvents2) {
    if (ev.type === CombatEventType.BladeTraitActivated) traitCount2++;
  }
  assert.strictEqual(traitCount2, 0, 'second attack cycle should NOT emit BladeTraitActivated again');
  console.log('PASS: BladeTraitActivated fires only once (first hit)');
}

// Test 8: Loyal trait 不改变伤害，不触发事件
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'BrownBearBlade',
      role: 'Tank',
      element: 'Neutral',
      damageBonus: 0,
      hiddenProfile: { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 },
      individualTrait: 'Loyal',
    },
    autoAttackSpec: defaultSpec,
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 20; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) { hitResult = r; break; }
  }
  assert.strictEqual(hitResult.damageToApply.amount, Math.round(24 * 1.0));
  const traitEvent = (hitResult?.events ?? []).find((e) => e.type === CombatEventType.BladeTraitActivated);
  assert.strictEqual(traitEvent, undefined, 'Loyal should not emit BladeTraitActivated');
  console.log('PASS: Loyal trait does not change damage or emit events');
}
