import assert from 'node:assert/strict';

import { createBackpackGrid } from '../src/core/backpack-grid.js';

function createGrid() {
  return createBackpackGrid({ width: 9, height: 9 });
}

// Test 1: 9×9 背包创建
{
  const g = createGrid();
  assert.strictEqual(g.width, 9);
  assert.strictEqual(g.height, 9);
  assert.deepStrictEqual(g.getBladeItems(), []);
  assert.deepStrictEqual(g.getPlacementErrors(), []);
  console.log('PASS: 9×9 backpack created');
}

// Test 2: 3×3 Blade 合法放置
{
  const g = createGrid();
  const r = g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(g.getBladeItems().length, 1);
  assert.strictEqual(g.getPlacementErrors().length, 0);
  console.log('PASS: 3×3 Blade placed legally');
}

// Test 3: Blade 越界失败（x+width > width）
{
  const g = createGrid();
  const r = g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 7, y: 0, width: 3, height: 3 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('out of bounds'));
  assert.strictEqual(g.getPlacementErrors().length, 1);
  assert.strictEqual(g.getBladeItems().length, 0);
  console.log('PASS: Blade out-of-bounds (right edge) fails');
}

// Test 4: Blade 越界失败（y+height > height）
{
  const g = createGrid();
  const r = g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 7, width: 3, height: 3 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('out of bounds'));
  console.log('PASS: Blade out-of-bounds (bottom edge) fails');
}

// Test 5: Blade 越界失败（negative x）
{
  const g = createGrid();
  const r = g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: -1, y: 0, width: 3, height: 3 });
  assert.strictEqual(r.ok, false);
  console.log('PASS: Blade out-of-bounds (negative x) fails');
}

// Test 6: 两 Blade 重叠失败
{
  const g = createGrid();
  const r1 = g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  assert.strictEqual(r1.ok, true);
  const r2 = g.place({ instanceId: 'b2', itemId: 'GuardianBlade', type: 'Blade', x: 1, y: 1, width: 3, height: 3 });
  assert.strictEqual(r2.ok, false);
  assert.ok(r2.error.includes('overlaps'));
  assert.strictEqual(g.getBladeItems().length, 1);
  console.log('PASS: Two Blades overlapping fails');
}

// Test 7: 两 Blade 不重叠合法
{
  const g = createGrid();
  g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  const r2 = g.place({ instanceId: 'b2', itemId: 'GuardianBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3 });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(g.getBladeItems().length, 2);
  console.log('PASS: Two Blades non-overlapping succeed');
}

// Test 8: auto-generate instanceId
{
  const g = createGrid();
  const r = g.place({ itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  assert.strictEqual(r.ok, true);
  const items = g.getBladeItems();
  assert.ok(items[0].instanceId);
  console.log('PASS: instanceId auto-generated');
}

// Test 9: getSnapshot
{
  const g = createGrid();
  g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  const snap = g.getSnapshot();
  assert.strictEqual(snap.width, 9);
  assert.strictEqual(snap.height, 9);
  assert.strictEqual(snap.items.length, 1);
  console.log('PASS: getSnapshot works');
}

// Test 10: findItemById
{
  const g = createGrid();
  g.place({ instanceId: 'b1', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
  assert.ok(g.findItemById('b1'));
  assert.strictEqual(g.findItemById('nonexistent'), null);
  console.log('PASS: findItemById works');
}
