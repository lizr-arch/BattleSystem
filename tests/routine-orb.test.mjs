import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { ActorState, CombatEventType } from '../src/core/enums.js';

function setupRoutineActor({ targetHp = 999999 } = {}) {
  const actor = createDefaultCombatActor();
  actor.target.maxHp = targetHp;
  actor.target.hp = targetHp;
  actor.resetRuntime();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.autoAttackRange = 0;
  for (const art of actor.arts ?? []) {
    art.charge = art.maxCharge;
    if (art.id === 'Art1' || art.id === 'Art2' || art.id === 'Art3') {
      art.effect = null;
    }
  }
  actor.eventLog.clear();
  return actor;
}

function tickN(actor, frames) {
  for (let i = 0; i < frames; i += 1) actor.tick(new CombatInputFrame());
}

function newEventsSince(actor, beforeHead) {
  if (!beforeHead) return actor.eventLog.events;
  const idx = actor.eventLog.events.indexOf(beforeHead);
  if (idx < 0) return actor.eventLog.events;
  return actor.eventLog.events.slice(0, idx);
}

function hasEventSince(actor, beforeHead, type, predicate) {
  const events = newEventsSince(actor, beforeHead);
  return events.some((e) => String(e.type) === String(type) && (!predicate || predicate(e)));
}

function findEventSince(actor, beforeHead, type, predicate) {
  const events = newEventsSince(actor, beforeHead);
  return events.find((e) => String(e.type) === String(type) && (!predicate || predicate(e))) ?? null;
}

function castArtAndWaitHit(actor, slot, artId) {
  const beforeHead = actor.eventLog.events[0] ?? null;
  actor.tick(new CombatInputFrame({ artSlotsPressed: [slot] }));
  if (actor.state !== ActorState.Art) {
    const last = actor.eventLog.events[0] ?? null;
    assert.fail(`Art not started ${artId} state=${actor.state} last=${last?.type ?? 'none'}`);
  }
  for (let i = 0; i < 120; i += 1) {
    const recent = newEventsSince(actor, beforeHead);
    if (recent.some((e) => e.type === CombatEventType.ActionWhiffed && e.data?.artId === artId)) {
      assert.fail(`ActionWhiffed ${artId}`);
    }
    if (recent.some((e) => e.type === CombatEventType.ActionHit && e.data?.artId === artId)) return;
    actor.tick(new CombatInputFrame());
  }
  assert.fail(`Timed out waiting for ActionHit ${artId}`);
}

function waitUntilLocomotion(actor) {
  for (let i = 0; i < 600; i += 1) {
    if (actor.state === ActorState.Locomotion) return;
    actor.tick(new CombatInputFrame());
  }
  assert.fail('Timed out waiting for Locomotion');
}

function buildFireRoutineOrb(actor) {
  castArtAndWaitHit(actor, 0, 'Art1');
  waitUntilLocomotion(actor);
  castArtAndWaitHit(actor, 1, 'Art2');
  waitUntilLocomotion(actor);
  castArtAndWaitHit(actor, 2, 'Art3');
}

{
  const actor = setupRoutineActor();
  buildFireRoutineOrb(actor);
  const snap = actor.getSnapshot();
  assert.equal(snap.routineOrb?.routineId, 'FireRoutine');
  assert.equal(snap.routineOrb?.totalLayer, 6);
  assert.equal(snap.routineTiles?.length ?? 0, 3);
}

{
  const actor = setupRoutineActor();
  castArtAndWaitHit(actor, 0, 'Art1');
  const snap = actor.getSnapshot();
  assert.equal(snap.routineTiles?.length ?? 0, 1);
  assert.equal(snap.routineTiles?.[0]?.routineId, 'FireRoutine');
  assert.equal(snap.routineTiles?.[0]?.layer, 1);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.RoutineTileAdded));
}

{
  const actor = setupRoutineActor();
  buildFireRoutineOrb(actor);
  waitUntilLocomotion(actor);

  const before = actor.eventLog.events[0] ?? null;
  actor.arts[0].charge = actor.arts[0].maxCharge;
  castArtAndWaitHit(actor, 0, 'Art1');
  const removed = findEventSince(actor, before, CombatEventType.RoutineTileRemoved);
  assert.ok(removed);
  assert.equal(actor.getSnapshot().routineTiles?.length ?? 0, 3);
  assert.ok(findEventSince(actor, before, CombatEventType.RoutineOrbReplaced));
}

{
  const actor = setupRoutineActor();
  const before = actor.eventLog.events[0] ?? null;
  const result = actor.breakRoutineOrb();
  assert.equal(result.ok, false);
  assert.ok(findEventSince(actor, before, CombatEventType.RoutineOrbBreakFailed, (e) => e.data?.reason === 'no_orb'));
}

{
  const actor = setupRoutineActor();
  buildFireRoutineOrb(actor);
  waitUntilLocomotion(actor);

  const before = actor.eventLog.events[0] ?? null;
  const result = actor.breakRoutineOrb();
  assert.equal(result.ok, true);
  assert.ok(findEventSince(actor, before, CombatEventType.ElementDamageApplied, (e) => e.data?.element === 'Fire' && e.data?.amount === 120));
  assert.ok(findEventSince(actor, before, CombatEventType.DamageApplied, (e) => e.data?.source === 'Element' && e.data?.sourceId === 'RoutineOrbBreak' && e.data?.amount === 120));
  assert.ok(findEventSince(actor, before, CombatEventType.DebuffApplied, (e) => e.data?.type === 'Burn' && e.data?.durationFrames === 300));
  assert.equal(actor.getSnapshot().routineOrb, null);
  assert.equal(actor.getSnapshot().routineTiles?.length ?? 0, 0);
}

{
  const actor = setupRoutineActor();
  buildFireRoutineOrb(actor);
  waitUntilLocomotion(actor);
  actor.breakRoutineOrb();
  actor.eventLog.clear();

  tickN(actor, 59);
  assert.equal(actor.eventLog.events.some((e) => e.type === CombatEventType.DebuffTickDamage), false);

  actor.tick(new CombatInputFrame());
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DebuffTickDamage && e.data?.type === 'Burn' && e.data?.amount === 5));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.DamageApplied && e.data?.source === 'Debuff' && e.data?.sourceId === 'Burn' && e.data?.amount === 5));
}

{
  const actor = setupRoutineActor({ targetHp: 280 });
  buildFireRoutineOrb(actor);
  waitUntilLocomotion(actor);
  actor.breakRoutineOrb();

  tickN(actor, 120);
  const snap = actor.getSnapshot();
  assert.equal(snap.battle?.result, 'Victory');
  assert.equal(snap.target?.dead, true);
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.TargetDefeated));
  assert.ok(actor.eventLog.events.some((e) => e.type === CombatEventType.BattleEnded && e.data?.result === 'Victory'));
}

console.log('routine orb test passed');

