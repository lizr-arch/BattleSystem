import assert from 'node:assert/strict';

import { BladeRuntime } from '../src/core/blade-runtime.js';
import { CombatEventType } from '../src/core/enums.js';

function createDummyTarget(hp = 999999) {
  return { x: 200, y: 200, radius: 38, hp, maxHp: hp, dead: false };
}

function createDummyActor(x = 100, y = 200) {
  return { x, y };
}

// Test 1: BladeRuntime 创建后初始状态 Idle, cooldown=0
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0.1,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 45 },
  });
  assert.strictEqual(b.state, 'Idle');
  assert.strictEqual(b.cooldownLeft, 0);
  const snap = b.getSnapshot();
  assert.strictEqual(snap.bladeInstanceId, 'b1');
  assert.strictEqual(snap.element, 'Fire');
  console.log('PASS: BladeRuntime created in Idle state');
}

// Test 2: 在范围内自动攻击启动
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0.1,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 45 },
  });
  const result = b.tick({ target: createDummyTarget(), actor: createDummyActor() });
  assert.strictEqual(b.state, 'Attacking');
  const hasStart = result.events.some((e) => e.type === CombatEventType.BladeAttackStarted);
  assert.ok(hasStart);
  console.log('PASS: Blade attack starts when target in range');
}

// Test 3: 不在范围内不启动攻击
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0.1,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 10, cooldownFrames: 45 },
  });
  const result = b.tick({ target: createDummyTarget(200, 200), actor: createDummyActor(0, 0) });
  assert.strictEqual(b.state, 'Idle');
  console.log('PASS: Blade does not attack when target out of range');
}

// Test 4: 冷却期间不启动攻击
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 5 },
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  const totalAction = 18 + 2 + 28;
  for (let i = 0; i < totalAction; i++) {
    b.tick({ target, actor });
  }
  assert.strictEqual(b.state, 'Cooldown');
  assert.ok(b.cooldownLeft > 0);
  b.tick({ target, actor });
  assert.strictEqual(b.state, 'Cooldown');
  console.log('PASS: Blade stays in cooldown during cooldown period');
}

// Test 5: 命中产生伤害
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0.1,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 45 },
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  let hitResult = null;
  for (let i = 1; i < 18; i++) {
    const r = b.tick({ target, actor });
    if (r.damageToApply) hitResult = r;
  }
  if (!hitResult) {
    hitResult = b.tick({ target, actor });
  }
  const hasHit = (hitResult?.events ?? []).some((e) => e.type === CombatEventType.BladeAttackHit);
  assert.ok(hasHit, 'should produce BladeAttackHit');
  const expectedDmg = Math.round(24 * 1.1);
  assert.ok(hitResult.damageToApply, 'should have damage to apply');
  assert.strictEqual(hitResult.damageToApply.amount, expectedDmg);
  assert.strictEqual(hitResult.damageToApply.source, 'Blade');
  console.log('PASS: Blade hit produces damage=' + expectedDmg);
}

// Test 6: 打空（out of range at active frame）
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0,
    },
    autoAttackSpec: { startupFrames: 18, activeFrames: 2, recoveryFrames: 28, damage: 24, range: 190, cooldownFrames: 45 },
  });
  const target = { x: 200, y: 200, radius: 38, hp: 999999, maxHp: 999999, dead: false };
  const actor = { x: 100, y: 200 };
  b.tick({ target, actor });
  target.x = 999;
  target.y = 999;
  let whiffResult = null;
  for (let i = 1; i < 18; i++) {
    const r = b.tick({ target, actor });
    if (r.events.some((e) => e.type === CombatEventType.BladeAttackWhiffed)) whiffResult = r;
  }
  if (!whiffResult) {
    whiffResult = b.tick({ target, actor });
  }
  const hasWhiff = (whiffResult?.events ?? []).some((e) => e.type === CombatEventType.BladeAttackWhiffed);
  assert.ok(hasWhiff);
  assert.strictEqual(whiffResult?.damageToApply ?? null, null);
  console.log('PASS: Blade whiffs when target out of range');
}

// Test 7: 冷却结束后回到 Idle
{
  const b = new BladeRuntime({
    resolvedBlade: {
      bladeInstanceId: 'b1',
      bladeId: 'CrimsonBlade',
      role: 'DPS',
      element: 'Fire',
      damageBonus: 0,
    },
    autoAttackSpec: { startupFrames: 1, activeFrames: 1, recoveryFrames: 1, damage: 1, range: 190, cooldownFrames: 1 },
  });
  const target = createDummyTarget();
  const actor = createDummyActor();
  b.tick({ target, actor });
  b.tick({ target, actor });
  b.tick({ target, actor });
  assert.strictEqual(b.state, 'Cooldown');
  b.tick({ target, actor });
  assert.strictEqual(b.state, 'Idle');
  console.log('PASS: Blade returns to Idle after cooldown');
}
