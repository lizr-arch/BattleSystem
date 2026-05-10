import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { formatCombatEvent } from '../src/core/combat-events.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { DriverComboState } from '../src/core/driver-combo.js';
import { ActorState, CombatEventType, DriverComboEffect, DriverComboStage } from '../src/core/enums.js';

function tick(actor, input = new CombatInputFrame()) {
  actor.tick(input);
}

function tickN(actor, frames, input = new CombatInputFrame()) {
  for (let i = 0; i < frames; i += 1) tick(actor, input);
}

function findEvent(actor, predicate) {
  return actor.eventLog.events.find(predicate) ?? null;
}

function hasAnyDriverComboEvent(actor) {
  return actor.eventLog.events.some((e) => String(e.type).startsWith('DriverCombo'));
}

function createInRangeActor() {
  const actor = createDefaultCombatActor();
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  return actor;
}

{
  const dc = new DriverComboState();
  assert.equal(dc.stage, DriverComboStage.None);
  assert.equal(dc.framesLeft, 0);
  assert.equal(dc.tick(1), null);

  dc.apply(DriverComboEffect.Break);
  const expired = dc.tick(180);
  assert.ok(expired);
  assert.equal(expired.type, CombatEventType.DriverComboExpired);
  assert.equal(expired.data.stage, DriverComboStage.Break);
  assert.equal(formatCombatEvent(expired.type, expired.data), 'DriverComboExpired Break');
  assert.equal(dc.stage, DriverComboStage.None);
  assert.equal(dc.framesLeft, 0);
}

{
  const actor = createInRangeActor();
  actor.arts[0].charge = actor.arts[0].maxCharge;

  tick(actor, new CombatInputFrame({ artSlotsPressed: [0] }));
  assert.equal(actor.state, ActorState.Art);

  tickN(actor, 15);

  const applied = findEvent(actor, (e) => e.type === CombatEventType.DriverComboApplied);
  assert.ok(applied);
  assert.equal(applied.data.stage, DriverComboStage.Break);
  assert.equal(applied.data.effect, DriverComboEffect.Break);
  assert.equal(applied.data.duration, 180);
  assert.equal(applied.data.framesLeft, 180);
  assert.equal(formatCombatEvent(applied.type, applied.data), 'DriverComboApplied Break 180f');
  assert.equal(actor.driverCombo.stage, DriverComboStage.Break);
  assert.equal(actor.driverCombo.framesLeft, 180);

  const actor2 = createInRangeActor();
  actor2.arts[0].charge = actor2.arts[0].maxCharge;
  tick(actor2, new CombatInputFrame({ artSlotsPressed: [0] }));
  actor2.x = actor2.target.x - 1000;
  actor2.y = actor2.target.y;

  tickN(actor2, 15);

  assert.ok(findEvent(actor2, (e) => e.type === CombatEventType.ActionWhiffed && e.data.artId === 'Art1'));
  assert.equal(hasAnyDriverComboEvent(actor2), false);
  assert.equal(actor2.driverCombo.stage, DriverComboStage.None);
  assert.equal(actor2.driverCombo.framesLeft, 0);
}

{
  const dc = new DriverComboState();
  const failed = dc.apply(DriverComboEffect.Topple);
  assert.equal(failed.type, CombatEventType.DriverComboFailed);
  assert.equal(failed.data.stage, DriverComboStage.None);
  assert.equal(failed.data.effect, DriverComboEffect.Topple);
  assert.equal(failed.data.requires, DriverComboEffect.Break);
  assert.equal(formatCombatEvent(failed.type, failed.data), 'DriverComboFailed stage=None effect=Topple requires=Break');
  assert.equal(dc.stage, DriverComboStage.None);
  assert.equal(dc.framesLeft, 0);
}

{
  const dc = new DriverComboState();
  dc.apply(DriverComboEffect.Break);
  assert.equal(dc.stage, DriverComboStage.Break);
  assert.equal(dc.framesLeft, 180);

  const refreshed = dc.apply(DriverComboEffect.Break);
  assert.equal(refreshed.type, CombatEventType.DriverComboRefreshed);
  assert.equal(refreshed.data.stage, DriverComboStage.Break);
  assert.equal(refreshed.data.duration, 180);
  assert.equal(refreshed.data.beforeFramesLeft, 180);
  assert.equal(refreshed.data.framesLeft, 180);
  assert.equal(formatCombatEvent(refreshed.type, refreshed.data), 'DriverComboRefreshed Break 180f->180f');
  assert.equal(dc.stage, DriverComboStage.Break);
  assert.equal(dc.framesLeft, 180);
}

{
  const dc = new DriverComboState();
  dc.apply(DriverComboEffect.Break);
  const advanced = dc.apply(DriverComboEffect.Topple);
  assert.equal(advanced.type, CombatEventType.DriverComboAdvanced);
  assert.equal(advanced.data.fromStage, DriverComboStage.Break);
  assert.equal(advanced.data.toStage, DriverComboStage.Topple);
  assert.equal(advanced.data.effect, DriverComboEffect.Topple);
  assert.equal(advanced.data.duration, 150);
  assert.equal(advanced.data.framesLeft, 150);
  assert.equal(formatCombatEvent(advanced.type, advanced.data), 'DriverComboAdvanced Break->Topple 150f');
  assert.equal(dc.stage, DriverComboStage.Topple);
  assert.equal(dc.framesLeft, 150);
}

{
  const dc = new DriverComboState({ stage: DriverComboStage.Topple, framesLeft: 150 });
  const advanced = dc.apply(DriverComboEffect.Launch);
  assert.equal(advanced.type, CombatEventType.DriverComboAdvanced);
  assert.equal(advanced.data.fromStage, DriverComboStage.Topple);
  assert.equal(advanced.data.toStage, DriverComboStage.Launch);
  assert.equal(advanced.data.effect, DriverComboEffect.Launch);
  assert.equal(advanced.data.duration, 120);
  assert.equal(advanced.data.framesLeft, 120);
  assert.equal(formatCombatEvent(advanced.type, advanced.data), 'DriverComboAdvanced Topple->Launch 120f');
  assert.equal(dc.stage, DriverComboStage.Launch);
  assert.equal(dc.framesLeft, 120);
}

{
  const dc = new DriverComboState({ stage: DriverComboStage.Topple, framesLeft: 150 });
  const failed = dc.apply(DriverComboEffect.Smash);
  assert.equal(failed.type, CombatEventType.DriverComboFailed);
  assert.equal(failed.data.stage, DriverComboStage.Topple);
  assert.equal(failed.data.effect, DriverComboEffect.Smash);
  assert.equal(failed.data.requires, DriverComboEffect.Launch);
  assert.equal(formatCombatEvent(failed.type, failed.data), 'DriverComboFailed stage=Topple effect=Smash requires=Launch');
  assert.equal(dc.stage, DriverComboStage.Topple);
  assert.equal(dc.framesLeft, 150);
}

{
  const dc = new DriverComboState({ stage: DriverComboStage.Launch, framesLeft: 120 });
  const finished = dc.apply(DriverComboEffect.Smash);
  assert.equal(finished.type, CombatEventType.DriverComboFinished);
  assert.equal(finished.data.stage, DriverComboStage.Launch);
  assert.equal(finished.data.effect, DriverComboEffect.Smash);
  assert.equal(formatCombatEvent(finished.type, finished.data), 'DriverComboFinished Smash');
  assert.equal(dc.stage, DriverComboStage.None);
  assert.equal(dc.framesLeft, 0);
}

{
  const dc = new DriverComboState({ stage: DriverComboStage.Launch, framesLeft: 120 });
  const failed = dc.apply(DriverComboEffect.Launch);
  assert.equal(failed.type, CombatEventType.DriverComboFailed);
  assert.equal(failed.data.stage, DriverComboStage.Launch);
  assert.equal(failed.data.effect, DriverComboEffect.Launch);
  assert.equal(failed.data.requires, DriverComboEffect.Smash);
  assert.equal(formatCombatEvent(failed.type, failed.data), 'DriverComboFailed stage=Launch effect=Launch requires=Smash');
  assert.equal(dc.stage, DriverComboStage.Launch);
  assert.equal(dc.framesLeft, 120);
}

console.log('driver combo test passed');
