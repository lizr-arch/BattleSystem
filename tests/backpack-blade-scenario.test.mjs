import assert from 'node:assert/strict';

import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatEventType } from '../src/core/enums.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';

function hasEvent(events, type, predicate) {
  return events.some((e) => String(e.type) === String(type) && (!predicate || predicate(e)));
}

function findEvent(events, type, predicate) {
  for (const e of events) {
    if (String(e.type) === String(type) && (!predicate || predicate(e))) return e;
  }
  return null;
}

function setupActorWithBlades(actor, bladeConfigs, socketAssignments) {
  const grid = createBackpackGrid({ width: 9, height: 9 });
  for (const cfg of bladeConfigs) {
    grid.place(cfg);
  }
  const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: socketAssignments ?? {} });
  actor.backpackGrid = grid;
  actor.resolvedLoadout = resolved;
  actor.bladeRuntimes = [];
  actor.eventLog.clear();
  if (resolved.event) {
    actor.emit(resolved.event.type, resolved.event.data);
  }
  for (const blade of resolved.activeBlades) {
    actor.linkBlade(blade);
  }
}

// Test Scenario 1: backpack-valid-blade-placement
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.eventLog.clear();

  const grid = createBackpackGrid({ width: 9, height: 9 });
  grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });

  const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  actor.resolvedLoadout = resolved;
  if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);

  const events = actor.eventLog.events;
  const resEvent = findEvent(events, CombatEventType.BackpackResolved);
  assert.ok(resEvent, 'BackpackResolved event should exist');
  assert.strictEqual(resEvent.data.activeBladeCount, 1);
  assert.strictEqual(resolved.activeBlades.length, 1);
  console.log('PASS scenario: backpack-valid-blade-placement');
}

// Test Scenario 2: backpack-rejects-overlap
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.eventLog.clear();

  const grid = createBackpackGrid({ width: 9, height: 9, items: [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 1, y: 1, width: 3, height: 3 },
  ]});

  const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });

  assert.ok(resolved.errors.length > 0, 'should have errors');
  assert.strictEqual(resolved.event.type, CombatEventType.BackpackInvalid);
  assert.strictEqual(resolved.activeBlades.length, 0);
  console.log('PASS scenario: backpack-rejects-overlap');
}

// Test Scenario 3: blade-socket-resolves-fire-core
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.eventLog.clear();

  const grid = createBackpackGrid({ width: 9, height: 9 });
  grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });

  const resolved = resolveLoadout({
    backpackGrid: grid,
    socketAssignments: { 'blade_001:socket_1': 'FireCore' },
  });

  assert.strictEqual(resolved.activeBlades[0].element, 'Fire');
  assert.strictEqual(resolved.activeBlades[0].damageBonus, 0.1);
  assert.strictEqual(resolved.activeBlades[0].sockets[0].itemId, 'FireCore');
  console.log('PASS scenario: blade-socket-resolves-fire-core');
}

// Test Scenario 4: blade-auto-attack-hits-target
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.target.hp = 999999;
  actor.target.maxHp = 999999;
  actor.target.dead = false;

  setupActorWithBlades(actor, [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
  ], { 'blade_001:socket_1': 'FireCore' });

  // Tick until BladeAttackHit
  for (let i = 0; i < 200; i++) {
    actor.tick(new CombatInputFrame());
    if (hasEvent(actor.eventLog.events, CombatEventType.BladeAttackHit)) break;
  }

  const events = actor.eventLog.events;
  assert.ok(hasEvent(events, CombatEventType.BladeLinked), 'BladeLinked should exist');
  assert.ok(hasEvent(events, CombatEventType.BladeAttackStarted), 'BladeAttackStarted should exist');
  assert.ok(hasEvent(events, CombatEventType.BladeAttackHit), 'BladeAttackHit should exist');
  assert.ok(hasEvent(events, CombatEventType.DamageApplied, (e) => e.data?.source === 'Blade'), 'DamageApplied source=Blade should exist');
  assert.ok(hasEvent(events, CombatEventType.TargetHpChanged), 'TargetHpChanged should exist');
  console.log('PASS scenario: blade-auto-attack-hits-target');
}

// Test Scenario 5: blade-auto-attack-whiffs-out-of-range
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.x = 100;
  actor.y = 200;
  actor.target.x = 200;
  actor.target.y = 200;
  actor.target.hp = 999999;
  actor.target.maxHp = 999999;
  actor.target.dead = false;

  setupActorWithBlades(actor, [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
  ]);

  // Tick once to start blade attack (target close)
  actor.tick(new CombatInputFrame());
  // Move far away before blade reaches Active (startup=18 frames)
  actor.target.x = 999;
  actor.target.y = 999;

  for (let i = 0; i < 200; i++) {
    actor.tick(new CombatInputFrame());
    if (hasEvent(actor.eventLog.events, CombatEventType.BladeAttackWhiffed)) break;
  }

  const events = actor.eventLog.events;
  assert.ok(hasEvent(events, CombatEventType.BladeAttackStarted), 'BladeAttackStarted should exist');
  assert.ok(hasEvent(events, CombatEventType.BladeAttackWhiffed), 'BladeAttackWhiffed should exist');
  const bladeDamage = hasEvent(events, CombatEventType.DamageApplied, (e) => e.data?.source === 'Blade');
  assert.ok(!bladeDamage, 'No DamageApplied from Blade on whiff');
  console.log('PASS scenario: blade-auto-attack-whiffs-out-of-range');
}

// Test Scenario 6: multiple-blades-limit-two-active
{
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;

  setupActorWithBlades(actor, [
    { instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3 },
    { instanceId: 'blade_003', itemId: 'CrimsonBlade', type: 'Blade', x: 6, y: 0, width: 3, height: 3 },
  ]);

  assert.strictEqual(actor.bladeRuntimes.length, 2);
  console.log('PASS scenario: multiple-blades-limit-two-active');
}
