import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { CombatEventType } from '../src/core/enums.js';

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
  actor.player.hp = 1;

  const { timeline } = tickUntil(actor, ({ timeline }) => indexOfEvent(timeline, CombatEventType.PlayerDefeated) >= 0, { maxTicks: 400 });

  const defeatedIdx = indexOfEvent(timeline, CombatEventType.PlayerDefeated);
  const endedIdx = indexOfEvent(timeline, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat');

  assert.ok(defeatedIdx >= 0);
  assert.ok(endedIdx >= 0);
  assert.ok(defeatedIdx < endedIdx);

  assert.equal(actor.player.dead, true);
  assert.equal(actor.battle.active, false);
  assert.equal(actor.battle.result, 'Defeat');

  const defeatedFrame = timeline[defeatedIdx]?.frame ?? null;
  const endedFrame = timeline[endedIdx]?.frame ?? null;
  assert.equal(defeatedFrame, endedFrame);

  const post = [];
  for (let i = 0; i < 5; i += 1) post.push(...tickOnce(actor));
  assert.equal(post.length, 0);
}

console.log('player defeat tests passed');
