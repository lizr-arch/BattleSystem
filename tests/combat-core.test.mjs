import assert from 'node:assert/strict';
import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { ActorState, ActionPhase, CombatEventType } from '../src/core/enums.js';

function createInRangeActor() {
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  return actor;
}

function tick(actor, input = new CombatInputFrame()) {
  actor.tick(input);
}

function tickN(actor, frames, input) {
  for (let i = 0; i < frames; i += 1) tick(actor, input);
}

function findEvent(actor, predicate) {
  return actor.eventLog.events.find(predicate) ?? null;
}

function countEvents(actor, predicate) {
  return actor.eventLog.events.filter(predicate).length;
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  assert.equal(actor.state, ActorState.AutoAttack);
  assert.ok(actor.action);
  assert.equal(actor.action.spec.id, 'AA1');
}

{
  const actor = createInRangeActor();
  const move = new CombatInputFrame({ moveX: 1, moveY: 0 });
  tickN(actor, 180, move);
  assert.equal(actor.state, ActorState.Locomotion);
  assert.equal(actor.action, null);
  assert.equal(actor.arts[0].charge, 0);
  assert.equal(countEvents(actor, (e) => e.type === CombatEventType.ActionStarted), 0);
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  const before = actor.position;
  const startupMove = new CombatInputFrame({ moveX: 1, moveY: 0 });
  tickN(actor, 10, startupMove);
  assert.equal(actor.state, ActorState.AutoAttack);
  assert.equal(actor.action?.phase, ActionPhase.Startup);
  assert.deepEqual(actor.position, before);
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  tickN(actor, 18, new CombatInputFrame());
  assert.equal(actor.arts[0].charge, 1);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ActionHit && e.data.actionId === 'AA1'));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ArtChargeChanged && e.data.artId === 'Art1'));
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  tickN(actor, 18, new CombatInputFrame());
  assert.equal(actor.arts.length, 4);
  assert.equal(actor.arts[0].charge, 1);
  assert.equal(actor.arts[1].charge, 1);
  assert.equal(actor.arts[2].charge, 1);
  assert.equal(actor.arts[3].charge, 1);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ArtChargeChanged && e.data.artId === 'Art2'));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ArtChargeChanged && e.data.artId === 'Art3'));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ArtChargeChanged && e.data.artId === 'Art4'));
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  tickN(actor, 18, new CombatInputFrame());
  const chargeBefore = actor.arts[0].charge;
  tickN(actor, 2, new CombatInputFrame());
  assert.equal(actor.action?.phase, ActionPhase.Recovery);
  const before = actor.position;
  tick(actor, new CombatInputFrame({ moveX: 1, moveY: 0 }));
  assert.equal(actor.state, ActorState.Locomotion);
  assert.equal(actor.action, null);
  assert.equal(actor.arts[0].charge, chargeBefore);
  assert.ok(actor.position.x !== before.x || actor.position.y !== before.y);
  assert.equal(actor.cancelBonusLeft, 0);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.RecoveryCanceledToMovement));
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  const startupArtInput = new CombatInputFrame({ artSlotsPressed: [0] });
  tickN(actor, 8, startupArtInput);
  assert.equal(actor.state, ActorState.AutoAttack);
  assert.ok(actor.action);
  assert.equal(actor.action.phase, ActionPhase.Startup);
  assert.ok(!findEvent(actor, (e) => e.type === CombatEventType.RecoveryCanceledToArt));
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  let safety = 0;
  while (!actor.arts[0].ready && safety < 2000) {
    tick(actor, new CombatInputFrame());
    safety += 1;
  }
  assert.ok(actor.arts[0].ready);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.ArtBecameReady && e.data.artId === 'Art1'));

  while (
    actor.state !== ActorState.AutoAttack ||
    !actor.action ||
    !actor.action.spec.canCancelToArt(actor.action.elapsedFrames)
  ) {
    tick(actor, new CombatInputFrame());
    safety += 1;
    if (safety >= 2400) break;
  }

  assert.ok(actor.action);
  assert.equal(actor.state, ActorState.AutoAttack);
  assert.ok(actor.action.spec.canCancelToArt(actor.action.elapsedFrames));
  assert.ok(actor.cancelBonusLeft > 0);

  tick(actor, new CombatInputFrame({ artSlotsPressed: [0] }));
  assert.equal(actor.state, ActorState.Art);
  assert.equal(actor.currentArt?.id, 'Art1');
  assert.ok(actor.currentArtCanceled);
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.RecoveryCanceledToArt));
  assert.ok(findEvent(actor, (e) => e.type === CombatEventType.CancelBonusApplied && e.data.artId === 'Art1'));

  tickN(actor, 15, new CombatInputFrame());
  const artHit = findEvent(actor, (e) => e.type === CombatEventType.ActionHit && e.data.artId === 'Art1');
  assert.ok(artHit);
  assert.equal(artHit.data.damage, 48);
  assert.equal(artHit.data.canceled, true);
}

{
  const actor = createInRangeActor();
  tick(actor, new CombatInputFrame());
  tickN(actor, 20, new CombatInputFrame());
  assert.equal(actor.action?.spec.id, 'AA1');
  assert.equal(actor.action?.phase, ActionPhase.Recovery);
  assert.ok(actor.action.spec.canCancelToMovement(actor.action.elapsedFrames));
  assert.ok(actor.action.spec.canCancelToArt(actor.action.elapsedFrames));
}

console.log('combat core test passed');
