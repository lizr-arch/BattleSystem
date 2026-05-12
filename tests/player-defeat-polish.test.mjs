import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatInputFrame } from '../src/core/combat-input.js';
import { CombatEventType, EnemyState } from '../src/core/enums.js';
import { EnemyStrikeSpec } from '../src/core/enemy-strike.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

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

function setupDefeatScenario(actor) {
  actor.resetRuntime();
  actor.autoAttackRange = 0;
  actor.artRange = 0;
  actor.player.maxHp = 20;
  actor.player.hp = 20;
  actor.player.dead = false;
  actor.battle.active = true;
  actor.battle.result = null;
  actor.target.maxHp = 999999;
  actor.target.hp = 999999;
  actor.target.dead = false;
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  if (actor.enemy) {
    actor.enemy.strike = new EnemyStrikeSpec({
      id: 'TestEnemyStrike',
      startupFrames: 3,
      activeFrames: 1,
      recoveryFrames: 1,
      damage: 25,
      range: 999,
      cooldownFrames: 30,
    });
    actor.enemy.cooldownLeft = 0;
    actor.enemy.action = null;
  }
  actor.eventLog.clear();
}

function tickUntil(actor, predicate, { maxTicks = 2000 } = {}) {
  for (let i = 0; i < maxTicks; i += 1) {
    const events = tickOnce(actor);
    if (predicate({ actor, events })) return { events, ticks: i + 1 };
  }
  throw new Error('tickUntil timeout');
}

function hasEvent(events, type, predicate = null) {
  return events.some((e) => String(e.type) === String(type) && (!predicate || predicate(e)));
}

function eventsOfType(events, type) {
  return events.filter((e) => String(e.type) === String(type));
}

{
  const actor = createActor();
  setupDefeatScenario(actor);
  actor.enemy.cooldownLeft = 0;

  tickUntil(actor, ({ events }) => hasEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), { maxTicks: 400 });

  tickOnce(actor);

  assert.equal(actor.battle.active, false);
  assert.equal(actor.battle.result, 'Defeat');
  assert.equal(actor.player.dead, true);
  assert.equal(actor.player.hp, 0);
  assert.equal(actor.enemy.state, EnemyState.Idle);
  assert.equal(actor.enemy.action, null);

  const postDefeatEvents = [];
  for (let i = 0; i < 120; i += 1) {
    postDefeatEvents.push(...tickOnce(actor));
  }

  assert.equal(hasEvent(postDefeatEvents, CombatEventType.EnemyAttackStarted), false, 'No EnemyAttackStarted after Defeat');
  assert.equal(hasEvent(postDefeatEvents, CombatEventType.EnemyAttackHit), false, 'No EnemyAttackHit after Defeat');
  assert.equal(hasEvent(postDefeatEvents, CombatEventType.PlayerDamageApplied), false, 'No PlayerDamageApplied after Defeat');
  assert.equal(hasEvent(postDefeatEvents, CombatEventType.ActionStarted), false, 'No ActionStarted after Defeat');
  assert.equal(hasEvent(postDefeatEvents, CombatEventType.EnemyAttackCooldownStarted), false, 'No new cooldown after Defeat');

  assert.equal(actor.player.hp, 0, 'Player HP still 0 after Defeat');
  assert.equal(actor.player.dead, true, 'Player still dead');
  assert.equal(actor.battle.active, false, 'Battle still inactive');
  assert.equal(actor.battle.result, 'Defeat', 'Battle result still Defeat');
}

{
  const actor = createActor();
  setupDefeatScenario(actor);
  actor.enemy.cooldownLeft = 0;

  tickUntil(actor, ({ events }) => hasEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), { maxTicks: 400 });

  tickOnce(actor);

  for (let i = 0; i < 10; i += 1) {
    actor.tick(new CombatInputFrame({ artSlotsPressed: [0] }));
    actor.tick(new CombatInputFrame({ artSlotsPressed: [1] }));
  }
  actor.consumeEvents();

  const postEvents = actor.consumeEvents();
  actor.tick(new CombatInputFrame({ moveX: 1, moveY: 0 }));
  actor.tick(new CombatInputFrame({ moveX: -1, moveY: 0 }));
  postEvents.push(...actor.consumeEvents());

  assert.equal(hasEvent(postEvents, CombatEventType.ActionStarted), false, 'No ActionStarted after Defeat');
  assert.equal(hasEvent(postEvents, CombatEventType.InputConsumed), false, 'No InputConsumed after Defeat');
  assert.equal(hasEvent(postEvents, CombatEventType.EnemyAttackStarted), false, 'No EnemyAttackStarted after Defeat');
  assert.equal(actor.battle.result, 'Defeat', 'Still Defeat after input attempts');
  assert.equal(actor.player.hp, 0, 'Still 0 HP after input');
}

{
  const actor = createActor();
  setupDefeatScenario(actor);
  actor.enemy.cooldownLeft = 0;

  tickUntil(actor, ({ events }) => hasEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), { maxTicks: 400 });

  actor.resetRuntime();
  actor.player.maxHp = 999999;
  actor.player.hp = 999999;

  assert.equal(actor.battle.active, true);
  assert.equal(actor.battle.result, null);
  assert.equal(actor.player.dead, false);
  assert.equal(actor.player.hp, 999999);
  assert.equal(actor.target.dead, false);
  assert.equal(actor.target.hp, actor.target.maxHp);
  assert.equal(actor.enemy.action, null);
  assert.equal(actor.enemy.state, EnemyState.Idle);
  assert.equal(actor.lastEnemyOutcome, null);

  const resetEvents = actor.consumeEvents();
  assert.equal(hasEvent(resetEvents, CombatEventType.Reset), true, 'Reset event emitted');
  assert.equal(hasEvent(resetEvents, CombatEventType.BattleStarted), true, 'BattleStarted event emitted');

  for (let i = 0; i < 60; i += 1) {
    tickOnce(actor);
  }

  assert.equal(actor.battle.active, true, 'Still active after post-reset tick');
  assert.equal(actor.player.dead, false, 'Player alive after reset');
}

{
  const actor = createActor();
  actor.resetRuntime();
  const snapshot = actor.getSnapshot();
  assert.equal(snapshot.lastEnemyOutcome, null, 'lastEnemyOutcome is null after reset');
}

{
  const scenarioRunnerResult = runScenario({
    actor: createDefaultCombatActor(),
    ...getScenario('player-defeat-stops-combat'),
    logToConsole: false,
  });
  assert.equal(scenarioRunnerResult.passed, true, 'player-defeat-stops-combat scenario PASS');
  const s = scenarioRunnerResult.finalSnapshot;
  assert.equal(s.battle?.result, 'Defeat');
  assert.equal(s.player?.hp, 0);
  assert.equal(s.player?.dead, true);
}

{
  const scenarioRunnerResult = runScenario({
    actor: createDefaultCombatActor(),
    ...getScenario('reset-after-defeat'),
    logToConsole: false,
  });
  assert.equal(scenarioRunnerResult.passed, true, 'reset-after-defeat scenario PASS');
  const s = scenarioRunnerResult.finalSnapshot;
  assert.equal(s.battle?.active, true);
  assert.equal(s.battle?.result, null);
}

{
  const scenarioRunnerResult = runScenario({
    actor: createDefaultCombatActor(),
    ...getScenario('input-ignored-after-defeat'),
    logToConsole: false,
  });
  assert.equal(scenarioRunnerResult.passed, true, 'input-ignored-after-defeat scenario PASS');
  const s = scenarioRunnerResult.finalSnapshot;
  assert.equal(s.battle?.result, 'Defeat');
  assert.equal(s.player?.hp, 0);
}

{
  const actor = createActor();
  setupDefeatScenario(actor);
  actor.enemy.cooldownLeft = 0;

  tickUntil(actor, ({ events }) => hasEvent(events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), { maxTicks: 400 });

  tickOnce(actor);

  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.battle?.result, 'Defeat', 'finalSnapshot keeps Defeat result');
  assert.equal(finalSnapshot.player?.hp, 0, 'finalSnapshot keeps player HP 0');
  assert.equal(finalSnapshot.player?.dead, true, 'finalSnapshot keeps player dead true');
  assert.equal(finalSnapshot.enemy?.currentAction, null, 'finalSnapshot enemy action is null');
  assert.equal(finalSnapshot.enemy?.state, 'Idle', 'finalSnapshot enemy state is Idle');
}

console.log('player defeat polish tests passed');
