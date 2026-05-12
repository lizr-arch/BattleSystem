import assert from 'node:assert/strict';

import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';
import { CombatEventType } from '../src/core/enums.js';

// Helpers
function makeGridWith(items) {
  const g = createBackpackGrid({ width: 9, height: 9 });
  for (const item of items) {
    g.place(item);
  }
  return g;
}

// Test 1: 合法背包输出 activeBlades（1 Blade, no core）
{
  const grid = makeGridWith([
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.activeBlades.length, 1);
  assert.strictEqual(result.activeBlades[0].bladeId, 'CrimsonBlade');
  assert.strictEqual(result.activeBlades[0].element, 'Neutral');
  assert.strictEqual(result.activeBlades[0].damageBonus, 0);
  assert.ok(result.event);
  assert.strictEqual(result.event.type, CombatEventType.BackpackResolved);
  console.log('PASS: valid backpack resolves 1 blade with Neutral element');
}

// Test 2: FireCore 插入 socket 后 element === 'Fire'
{
  const grid = makeGridWith([
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
  ]);
  const result = resolveLoadout({
    backpackGrid: grid,
    socketAssignments: { 'blade_001:socket_1': 'FireCore' },
  });
  assert.strictEqual(result.activeBlades[0].element, 'Fire');
  assert.strictEqual(result.activeBlades[0].damageBonus, 0.1);
  assert.strictEqual(result.activeBlades[0].sockets.length, 1);
  assert.strictEqual(result.activeBlades[0].sockets[0].itemId, 'FireCore');
  console.log('PASS: FireCore in socket resolves element=Fire damageBonus=0.1');
}

// Test 3: 重叠背包输出 errors，activeBlades 为空
{
  const grid = createBackpackGrid({ width: 9, height: 9, items: [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 1, y: 1, width: 3, height: 3 },
  ]});
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.ok(result.errors.length > 0);
  assert.strictEqual(result.activeBlades.length, 0);
  assert.strictEqual(result.event.type, CombatEventType.BackpackInvalid);
  console.log('PASS: overlapping backpack produces BackpackInvalid + no active blades');
}

// Test 4: 3 个合法 Blade 时只激活 2 个
{
  const grid = makeGridWith([
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_003', itemId: 'CrimsonBlade', type: 'Blade', x: 6, y: 0, width: 3, height: 3 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(result.activeBlades.length, 2);
  assert.strictEqual(result.activeBlades[0].bladeInstanceId, 'blade_001');
  assert.strictEqual(result.activeBlades[1].bladeInstanceId, 'blade_002');
  console.log('PASS: max 2 active blades from 3 valid placements');
}

// Test 5: Socket 全局坐标正确
{
  const grid = makeGridWith([
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 2, y: 3, width: 3, height: 3 },
  ]);
  const result = resolveLoadout({
    backpackGrid: grid,
    socketAssignments: { 'blade_001:socket_1': 'FireCore' },
  });
  const sock = result.activeBlades[0].sockets[0];
  assert.strictEqual(sock.globalX, 3); // 2 + 1
  assert.strictEqual(sock.globalY, 4); // 3 + 1
  console.log('PASS: socket global position computed correctly');
}

// Test 6: 空背包
{
  const grid = createBackpackGrid({ width: 9, height: 9 });
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(result.activeBlades.length, 0);
  assert.strictEqual(result.errors.length, 0);
  console.log('PASS: empty backpack resolves to 0 active blades');
}

// Test 7: 背包越界
{
  const grid = createBackpackGrid({ width: 9, height: 9, items: [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 7, y: 7, width: 3, height: 3 },
  ]});
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.ok(result.errors.length > 0);
  assert.strictEqual(result.activeBlades.length, 0);
  console.log('PASS: out-of-bounds backpack resolves with errors');
}

// Test 8: 无 Core 时 element=Neutral，sockets 仍被记录
{
  const grid = makeGridWith([
    { instanceId: 'blade_001', itemId: 'GuardianBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(result.activeBlades[0].element, 'Neutral');
  assert.strictEqual(result.activeBlades[0].sockets.length, 1);
  assert.strictEqual(result.activeBlades[0].sockets[0].itemId, null);
  console.log('PASS: no core -> Neutral element, socket recorded as empty');
}
