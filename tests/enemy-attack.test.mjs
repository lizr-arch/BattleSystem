import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { CombatEventType, DriverComboStage, EnemyState } from '../src/core/enums.js';

function createActor() {
  const actor = createDefaultCombatActor();
  actor.autoAttackRange = 0;
  actor.artRange = 0;
  actor.consumeEvents();
  return actor;
}

function tickOnce(actor) {
  actor.tick(new CombatInputFrame());
  return actor.consumeEvents();
}

function tickUntil(actor, predicate, { maxTicks = 2000 } = {}) {
  const timeline = [];
  for (let i = 0; i < maxTicks; i += 1) {
    const events = tickOnce(actor);
    timeline.push(...events);
    if (predicate({ actor, events, timeline })) {
      return { actor, timeline, ticks: i + 1 };
    }
  }
  throw new Error('tickUntil timeout');
}

function eventsOf(timeline, type) {
  return (timeline ?? []).filter((e) => String(e?.type ?? '') === String(type));
}

function hasEvent(timeline, type, predicate = null) {
  for (const e of timeline ?? []) {
    if (String(e?.type ?? '') !== String(type)) continue;
    if (!predicate || predicate(e)) return true;
  }
  return false;
}

function indexOfEvent(timeline, type, predicate = null) {
  for (let i = 0; i < (timeline ?? []).length; i += 1) {
    const e = timeline[i];
    if (String(e?.type ?? '') !== String(type)) continue;
    if (!predicate || predicate(e)) return i;
  }
  return -1;
}

{
  const actor = createActor();

  const { timeline } = tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackCooldownFinished), { maxTicks: 2000 });

  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackStarted));
  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackFinished));
  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackCooldownStarted));
  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackCooldownFinished));

  const phaseChanges = eventsOf(timeline, CombatEventType.EnemyAttackPhaseChanged)
    .map((e) => `${String(e.data?.before)}->${String(e.data?.after)}`);

  const s2a = phaseChanges.indexOf('Startup->Active');
  const a2r = phaseChanges.indexOf('Active->Recovery');
  const r2f = phaseChanges.indexOf('Recovery->Finished');
  assert.ok(s2a >= 0, 'Expected Startup->Active');
  assert.ok(a2r > s2a, 'Expected Active->Recovery after Startup->Active');
  assert.ok(r2f > a2r, 'Expected Recovery->Finished after Active->Recovery');

  assert.equal(eventsOf(timeline, CombatEventType.EnemyAttackHit).length, 1);
  assert.equal(eventsOf(timeline, CombatEventType.EnemyAttackWhiffed).length, 0);
}

{
  const actor = createActor();
  const hp0 = actor.player.hp;

  const { timeline } = tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackHit), { maxTicks: 400 });

  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackHit, (e) => (e.data?.damage ?? 0) > 0));
  assert.ok(hasEvent(timeline, CombatEventType.PlayerDamageApplied, (e) => e.data?.source === 'EnemyStrike' && (e.data?.amount ?? 0) > 0));
  assert.ok(hasEvent(timeline, CombatEventType.PlayerHpChanged, (e) => (e.data?.before ?? 0) > (e.data?.after ?? 0)));
  assert.ok(actor.player.hp < hp0);
}

{
  const actor = createActor();
  const hp0 = actor.player.hp;

  tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackStarted), { maxTicks: 30 });
  for (let i = 0; i < 10; i += 1) tickOnce(actor);
  actor.x = 0;
  actor.y = 0;

  const { timeline } = tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackWhiffed, (e) => e.data?.reason === 'out_of_range'), { maxTicks: 400 });

  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackWhiffed, (e) => e.data?.reason === 'out_of_range'));
  assert.equal(eventsOf(timeline, CombatEventType.EnemyAttackHit).length, 0);
  assert.equal(eventsOf(timeline, CombatEventType.PlayerDamageApplied).length, 0);
  assert.equal(actor.player.hp, hp0);
}

{
  const actor = createActor();
  const timeline = [];

  tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackCooldownStarted), { maxTicks: 600 });

  actor.x = 0;
  actor.y = 0;

  const strike = actor.enemy?.strike;
  assert.ok(strike?.cooldownFrames > 0);

  for (let i = 0; i < strike.cooldownFrames - 1; i += 1) {
    timeline.push(...tickOnce(actor));
    assert.equal(hasEvent(timeline.slice(-20), CombatEventType.EnemyAttackStarted), false);
  }

  tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackCooldownFinished), { maxTicks: 400 });
  assert.equal(actor.enemy.cooldownLeft, 0);
  assert.equal(actor.enemy.action, null);

  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  const events = tickOnce(actor);
  assert.ok(events.some((e) => e.type === CombatEventType.EnemyAttackStarted));
}

{
  const actor = createActor();
  actor.driverCombo.stage = DriverComboStage.Topple;
  actor.driverCombo.framesLeft = 60;

  const timeline = [];
  for (let i = 0; i < 10; i += 1) timeline.push(...tickOnce(actor));

  assert.equal(hasEvent(timeline, CombatEventType.EnemyAttackStarted), false);
  assert.equal(actor.enemy.state, EnemyState.Controlled);
  assert.equal(actor.enemy.action, null);

  actor.driverCombo.stage = DriverComboStage.None;
  actor.driverCombo.framesLeft = 0;

  const { timeline: after } = tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackStarted), { maxTicks: 60 });
  assert.ok(hasEvent(after, CombatEventType.EnemyAttackStarted));
}

{
  const actor = createActor();

  tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackStarted), { maxTicks: 30 });
  assert.ok(actor.enemy.action);

  actor.driverCombo.stage = DriverComboStage.Launch;
  actor.driverCombo.framesLeft = 60;

  const { timeline } = tickUntil(actor, ({ timeline }) => hasEvent(timeline, CombatEventType.EnemyAttackInterrupted), { maxTicks: 60 });

  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackInterrupted, (e) => e.data?.reason === 'driver_combo'));
  assert.ok(hasEvent(timeline, CombatEventType.EnemyAttackCooldownStarted));
  assert.equal(actor.enemy.action, null);

  const interruptedAt = indexOfEvent(timeline, CombatEventType.EnemyAttackInterrupted);
  const hitAfter = indexOfEvent(timeline.slice(interruptedAt + 1), CombatEventType.EnemyAttackHit);
  assert.equal(hitAfter, -1);
}

console.log('enemy attack tests passed');
