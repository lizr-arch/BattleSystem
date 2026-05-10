import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { ActorState, CombatEventType } from '../src/core/enums.js';

function tick(actor, input = new CombatInputFrame()) {
  actor.tick(input);
}

function tickN(actor, frames, input) {
  for (let i = 0; i < frames; i += 1) tick(actor, input);
}

function findEvent(actor, predicate) {
  return actor.eventLog.events.find(predicate) ?? null;
}

{
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;

  const art = actor.arts[0];
  art.effect = null;
  art.specialChargeGain = 100;

  art.charge = art.maxCharge;
  actor.startArt(art, false);
  tickN(actor, art.actionSpec.startupFrames, new CombatInputFrame());
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialChargeChanged && e.data.afterCharge === 100));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialBecameReady && e.data.readyLevel === 1));

  art.charge = art.maxCharge;
  actor.startArt(art, false);
  tickN(actor, art.actionSpec.startupFrames, new CombatInputFrame());
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialChargeChanged && e.data.afterCharge === 200));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialBecameReady && e.data.readyLevel === 2));

  art.charge = art.maxCharge;
  actor.startArt(art, false);
  tickN(actor, art.actionSpec.startupFrames, new CombatInputFrame());
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialChargeChanged && e.data.afterCharge === 300));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialBecameReady && e.data.readyLevel === 3));
}

{
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.specialGauge.charge = 100;
  assert.equal(actor.specialGauge.readyLevel, 1);

  const ok = actor.castSpecial('Special3');
  assert.equal(ok, false);
  assert.equal(actor.state, ActorState.Locomotion);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialCastFailed && e.data.specialId === 'Special3'));
}

{
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.specialGauge.charge = 250;
  assert.equal(actor.specialGauge.readyLevel, 2);

  const ok = actor.castSpecial('Special2');
  assert.equal(ok, true);
  assert.equal(actor.state, ActorState.Art);
  assert.equal(actor.currentSpecial?.id, 'Special2');
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialConsumed && e.data.specialId === 'Special2'));

  const spec = actor.currentSpecial.actionSpec;
  tickN(actor, spec.startupFrames, new CombatInputFrame());
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.SpecialHit && e.data.specialId === 'Special2'));
  assert.equal(actor.specialGauge.charge, 50);
  assert.equal(actor.specialGauge.readyLevel, 0);
}

console.log('special actor test passed');

