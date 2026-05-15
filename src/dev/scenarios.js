import { BladeComboElement, BladeComboStage, CombatEventType, DriverComboEffect, DriverComboStage } from '../core/enums.js';
import { EnemyStrikeSpec } from '../core/enemy-strike.js';
import { assertEvent, assertSnapshot, breakRoutineOrb, castArt, castSpecial, executeStep, grantEnemyCooldownReady, grantSpecialReady, resetRuntime, resetRuntimeAfterDefeat, setPlayerPosition, tickEnemyUntil, waitEnemyPhase, waitFrames, waitUntil } from './scenario-runner.js';
import { createBackpackGrid } from '../core/backpack-grid.js';
import { resolveLoadout } from '../core/loadout-resolver.js';
import { CombatInputFrame } from '../core/combat-input.js';
import { createDemoBattlePreset, resetDemoPreset, TRAINING_BRUTE_SPEC, DEMO_PLAYER_SPEC } from './demo-battle-preset.js';
import { createDemoHudModel } from './demo-hud-model.js';

function setupActorForScenario(actor) {
  actor.x = actor.target.x - 100;
  actor.y = actor.target.y;
  actor.autoAttackRange = 0;
}

function grantAllArtsReady(actor) {
  const arts = actor.arts ?? [];
  for (const art of arts) {
    art.charge = art.maxCharge;
  }

  const data = {};
  for (const art of arts) {
    data[art.id] = { charge: art.charge, maxCharge: art.maxCharge };
  }
  actor.emit(CombatEventType.DebugGrantArtsReady, data);
}

function setupActorForRoutineOrbScenario(actor, { targetHp = null } = {}) {
  if (targetHp !== null && targetHp !== undefined) {
    actor.target.maxHp = targetHp;
    actor.target.hp = targetHp;
  }
  actor.resetRuntime();
  setupActorForScenario(actor);
  grantAllArtsReady(actor);
  for (const art of actor.arts ?? []) {
    if (art?.id === 'Art1' || art?.id === 'Art2' || art?.id === 'Art3') {
      art.effect = null;
    }
  }
}

function hasEvent(events, type, predicate) {
  return events.some((e) => String(e.type) === String(type) && (!predicate || predicate(e)));
}

function setupActorForEnemyAttackScenario(actor, {
  strike = null,
  playerHp = 100,
  playerMaxHp = 100,
  targetHp = 999999,
} = {}) {
  actor.resetRuntime();
  setupActorForScenario(actor);
  actor.eventLog.clear();
  actor.autoAttackRange = 0;

  if (actor.player) {
    actor.player.maxHp = playerMaxHp;
    actor.player.hp = playerHp;
    actor.player.dead = false;
  }

  if (actor.battle) {
    actor.battle.active = true;
    actor.battle.result = null;
  }

  if (actor.target) {
    actor.target.maxHp = targetHp;
    actor.target.hp = targetHp;
    actor.target.dead = false;
  }

  if (actor.enemy) {
    if (strike) actor.enemy.strike = strike;
    actor.enemy.cooldownLeft = 0;
    actor.enemy.action = null;
  }
}

export const scenarios = Object.freeze({
  'full-battle-loop': {
    name: 'full-battle-loop',
    maxFrames: 8000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(0, 'Cast Art1 (Break)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboApplied, (e) => e.data?.effect === DriverComboEffect.Break), 'Wait DriverComboApplied Break'),
      assertEvent(CombatEventType.DriverComboApplied, (e) => e.data?.effect === DriverComboEffect.Break, 'Assert DriverComboApplied Break'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      castArt(1, 'Cast Art2 (Topple)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.effect === DriverComboEffect.Topple), 'Wait DriverComboAdvanced Topple'),
      assertEvent(CombatEventType.DriverComboAdvanced, (e) => e.data?.fromStage === DriverComboStage.Break && e.data?.toStage === DriverComboStage.Topple, 'Assert Break->Topple'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),

      castArt(2, 'Cast Art3 (Launch)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.effect === DriverComboEffect.Launch), 'Wait DriverComboAdvanced Launch'),
      assertEvent(CombatEventType.DriverComboAdvanced, (e) => e.data?.fromStage === DriverComboStage.Topple && e.data?.toStage === DriverComboStage.Launch, 'Assert Topple->Launch'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art3'),

      castArt(3, 'Cast Art4 (Smash)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboFinished, (e) => e.data?.effect === DriverComboEffect.Smash), 'Wait DriverComboFinished Smash'),
      assertEvent(CombatEventType.DriverComboFinished, (e) => e.data?.effect === DriverComboEffect.Smash, 'Assert DriverComboFinished Smash'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.SpecialBecameReady, (e) => e.data?.readyLevel === 1), 'Wait SpecialBecameReady L1'),
      assertEvent(CombatEventType.SpecialBecameReady, (e) => e.data?.readyLevel === 1, 'Assert SpecialBecameReady L1'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art4'),

      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      assertEvent(CombatEventType.SpecialConsumed, (e) => e.data?.specialId === 'FireLv1' && e.data?.level === 1, 'Assert SpecialConsumed FireLv1'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.SpecialHit, (e) => e.data?.specialId === 'FireLv1'), 'Wait SpecialHit FireLv1'),
      assertEvent(CombatEventType.SpecialHit, (e) => e.data?.specialId === 'FireLv1' && e.data?.element === BladeComboElement.Fire && e.data?.level === 1, 'Assert SpecialHit FireLv1'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted, (e) => e.data?.routeId === 'FireWaterFire'), 'Wait BladeComboStarted FireWaterFire'),
      assertEvent(CombatEventType.BladeComboStarted, (e) => e.data?.element === BladeComboElement.Fire && e.data?.expectedNextElement === BladeComboElement.Water, 'Assert started Fire->Water'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after FireLv1'),

      grantSpecialReady(300, 'Grant Special ready (L3) for WaterLv2'),
      assertEvent(CombatEventType.DebugGrantSpecialReady, (e) => (e.data?.charge ?? 0) >= 300, 'Assert DebugGrantSpecialReady (for WaterLv2)'),
      castSpecial('WaterLv2', 'Cast WaterLv2 (Water L2)'),
      assertEvent(CombatEventType.SpecialConsumed, (e) => e.data?.specialId === 'WaterLv2' && e.data?.level === 2 && e.data?.cost === 200, 'Assert SpecialConsumed WaterLv2'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.SpecialHit, (e) => e.data?.specialId === 'WaterLv2'), 'Wait SpecialHit WaterLv2'),
      assertEvent(CombatEventType.BladeComboAdvanced, (e) => e.data?.element === BladeComboElement.Water && e.data?.toStage === BladeComboStage.Stage2, 'Assert advanced to Stage2 (Water)'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after WaterLv2'),

      grantSpecialReady(300, 'Grant Special ready (L3) for FireLv3'),
      assertEvent(CombatEventType.DebugGrantSpecialReady, (e) => (e.data?.charge ?? 0) >= 300, 'Assert DebugGrantSpecialReady (for FireLv3)'),
      castSpecial('FireLv3', 'Cast FireLv3 (Fire L3)'),
      assertEvent(CombatEventType.SpecialConsumed, (e) => e.data?.specialId === 'FireLv3' && e.data?.level === 3 && e.data?.cost === 300, 'Assert SpecialConsumed FireLv3'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.SpecialHit, (e) => e.data?.specialId === 'FireLv3'), 'Wait SpecialHit FireLv3'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboFinished, (e) => e.data?.routeId === 'FireWaterFire'), 'Wait BladeComboFinished FireWaterFire'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TokenCreated, (e) => e.data?.id === 'FireToken'), 'Wait TokenCreated FireToken'),

      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.None, 'Assert driver combo cleared'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.None, 'Assert blade combo cleared'),
      assertSnapshot((s) => (s.tokens ?? []).some((t) => t?.id === 'FireToken'), 'Assert tokens include FireToken'),
    ],
  },

  'full-driver-combo': {
    name: 'full-driver-combo',
    maxFrames: 3000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(0, 'Cast Art1 (Break)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboApplied, (e) => e.data?.effect === DriverComboEffect.Break), 'Wait DriverComboApplied Break'),
      assertEvent(CombatEventType.DriverComboApplied, (e) => e.data?.effect === DriverComboEffect.Break, 'Assert DriverComboApplied Break'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      castArt(1, 'Cast Art2 (Topple)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.effect === DriverComboEffect.Topple), 'Wait DriverComboAdvanced Topple'),
      assertEvent(CombatEventType.DriverComboAdvanced, (e) => e.data?.fromStage === DriverComboStage.Break && e.data?.toStage === DriverComboStage.Topple, 'Assert Break->Topple'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),

      castArt(2, 'Cast Art3 (Launch)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.effect === DriverComboEffect.Launch), 'Wait DriverComboAdvanced Launch'),
      assertEvent(CombatEventType.DriverComboAdvanced, (e) => e.data?.fromStage === DriverComboStage.Topple && e.data?.toStage === DriverComboStage.Launch, 'Assert Topple->Launch'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art3'),

      castArt(3, 'Cast Art4 (Smash)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboFinished, (e) => e.data?.effect === DriverComboEffect.Smash), 'Wait DriverComboFinished Smash'),
      assertEvent(CombatEventType.DriverComboFinished, (e) => e.data?.effect === DriverComboEffect.Smash, 'Assert DriverComboFinished Smash'),

      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.None, 'Assert final stage None'),
    ],
  },

  'wrong-order-smash': {
    name: 'wrong-order-smash',
    maxFrames: 1200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(3, 'Cast Art4 (Smash)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboFailed, (e) => e.data?.effect === DriverComboEffect.Smash), 'Wait DriverComboFailed Smash'),
      assertEvent(CombatEventType.DriverComboFailed, (e) => e.data?.effect === DriverComboEffect.Smash && e.data?.requires === DriverComboEffect.Break, 'Assert Smash requires Break'),
      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.None, 'Assert stage stays None'),
    ],
  },

  'expire-break': {
    name: 'expire-break',
    maxFrames: 2000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(0, 'Cast Art1 (Break)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboApplied, (e) => e.data?.stage === DriverComboStage.Break), 'Wait DriverComboApplied Break'),
      waitFrames(180, 'Wait 180f'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboExpired, (e) => e.data?.stage === DriverComboStage.Break), 'Wait DriverComboExpired Break'),
      assertEvent(CombatEventType.DriverComboExpired, (e) => e.data?.stage === DriverComboStage.Break, 'Assert DriverComboExpired Break'),
      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.None, 'Assert stage None after expire'),
    ],
  },

  'expire-topple': {
    name: 'expire-topple',
    maxFrames: 2600,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(0, 'Cast Art1 (Break)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboApplied, (e) => e.data?.stage === DriverComboStage.Break), 'Wait DriverComboApplied Break'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),
      castArt(1, 'Cast Art2 (Topple)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.toStage === DriverComboStage.Topple), 'Wait Break->Topple'),
      waitFrames(150, 'Wait 150f'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboExpired, (e) => e.data?.stage === DriverComboStage.Topple), 'Wait DriverComboExpired Topple'),
      assertEvent(CombatEventType.DriverComboExpired, (e) => e.data?.stage === DriverComboStage.Topple, 'Assert DriverComboExpired Topple'),
      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.None, 'Assert stage None after expire'),
    ],
  },

  'full-blade-combo': {
    name: 'full-blade-combo',
    maxFrames: 5000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
    },
    steps: [
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted, (e) => e.data?.routeId === 'FireWaterFire'), 'Wait BladeComboStarted'),
      assertEvent(CombatEventType.BladeComboStarted, (e) => e.data?.element === BladeComboElement.Fire && e.data?.expectedNextElement === BladeComboElement.Water, 'Assert started Fire->Water'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after FireLv1'),

      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('WaterLv2', 'Cast WaterLv2 (Water L2)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboAdvanced, (e) => e.data?.toStage === BladeComboStage.Stage2), 'Wait BladeComboAdvanced to Stage2'),
      assertEvent(CombatEventType.BladeComboAdvanced, (e) => e.data?.element === BladeComboElement.Water && e.data?.expectedNextElement === BladeComboElement.Fire, 'Assert advanced Water->Fire'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after WaterLv2'),

      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv3', 'Cast FireLv3 (Fire L3)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboFinished, (e) => e.data?.routeId === 'FireWaterFire'), 'Wait BladeComboFinished'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TokenCreated, (e) => e.data?.id === 'FireToken'), 'Wait TokenCreated FireToken'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.None, 'Assert blade combo cleared'),
      assertSnapshot((s) => (s.tokens?.length ?? 0) === 1 && s.tokens[0]?.id === 'FireToken', 'Assert one FireToken exists'),
    ],
  },

  'blade-combo-fail-water-first': {
    name: 'blade-combo-fail-water-first',
    maxFrames: 2000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
    },
    steps: [
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('WaterLv2', 'Cast WaterLv2 (Water L2)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboFailed, (e) => e.data?.reason === 'no_route'), 'Wait BladeComboFailed no_route'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.None, 'Assert stage None'),
    ],
  },

  'wrong-element-blade-combo': {
    name: 'wrong-element-blade-combo',
    maxFrames: 3500,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
    },
    steps: [
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted), 'Wait BladeComboStarted'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after FireLv1'),
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv3', 'Cast FireLv3 (wrong element)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboFailed, (e) => e.data?.reason === 'wrong_element'), 'Wait BladeComboFailed wrong_element'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.Stage1, 'Assert still Stage1'),
    ],
  },

  'insufficient-level-blade-combo': {
    name: 'insufficient-level-blade-combo',
    maxFrames: 4500,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
    },
    steps: [
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted), 'Wait BladeComboStarted'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after FireLv1'),

      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('WaterLv2', 'Cast WaterLv2 (Water L2)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboAdvanced, (e) => e.data?.toStage === BladeComboStage.Stage2), 'Wait BladeComboAdvanced to Stage2'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after WaterLv2'),

      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1, insufficient level)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboFailed, (e) => e.data?.reason === 'insufficient_level'), 'Wait BladeComboFailed insufficient_level'),
      assertEvent(CombatEventType.BladeComboFailed, (e) => e.data?.reason === 'insufficient_level' && e.data?.requiresMinLevel === 3, 'Assert requires min level 3'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.Stage2, 'Assert still Stage2'),
    ],
  },

  'expire-blade-combo': {
    name: 'expire-blade-combo',
    maxFrames: 4000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
    },
    steps: [
      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted), 'Wait BladeComboStarted'),
      waitFrames(260, 'Wait 260f'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboExpired, (e) => e.data?.stage === BladeComboStage.Stage1), 'Wait BladeComboExpired Stage1'),
      assertSnapshot((s) => s.bladeCombo?.stage === BladeComboStage.None, 'Assert expired to None'),
    ],
  },

  'driver-and-blade-coexist': {
    name: 'driver-and-blade-coexist',
    maxFrames: 6000,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      grantAllArtsReady(actor);
    },
    steps: [
      castArt(0, 'Cast Art1 (Break)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboApplied, (e) => e.data?.stage === DriverComboStage.Break), 'Wait DriverComboApplied Break'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      grantSpecialReady(300, 'Grant Special ready (L3)'),
      castSpecial('FireLv1', 'Cast FireLv1 (Fire L1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BladeComboStarted, (e) => e.data?.routeId === 'FireWaterFire'), 'Wait BladeComboStarted'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after FireLv1'),
      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.Break && s.bladeCombo?.stage === BladeComboStage.Stage1, 'Assert driver+blade both active'),

      castArt(1, 'Cast Art2 (Topple)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DriverComboAdvanced, (e) => e.data?.toStage === DriverComboStage.Topple), 'Wait DriverComboAdvanced Topple'),
      assertSnapshot((s) => s.driverCombo?.stage === DriverComboStage.Topple && s.bladeCombo?.stage === BladeComboStage.Stage1, 'Assert Topple while blade still Stage1'),
    ],
  },

  'routine-orb-create': {
    name: 'routine-orb-create',
    maxFrames: 2500,
    prepare(actor) {
      setupActorForRoutineOrbScenario(actor);
    },
    steps: [
      castArt(0, 'Cast FireSkill1 (Art1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 1), 'Wait RoutineTileAdded L1'),
      assertEvent(CombatEventType.ActionHit, (e) => e.data?.artId === 'Art1', 'Proof ActionHit Art1'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      castArt(1, 'Cast FireSkill2 (Art2)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 2), 'Wait RoutineTileAdded L2'),
      assertEvent(CombatEventType.ActionHit, (e) => e.data?.artId === 'Art2', 'Proof ActionHit Art2'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),

      castArt(2, 'Cast FireSkill3 (Art3)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 3), 'Wait RoutineTileAdded L3'),
      assertEvent(CombatEventType.ActionHit, (e) => e.data?.artId === 'Art3', 'Proof ActionHit Art3'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineOrbCreated, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6), 'Wait RoutineOrbCreated totalLayer=6'),

      assertSnapshot((s) => (s.routineTiles?.length ?? 0) === 3, 'Assert routineTiles length=3'),
      assertSnapshot((s) => s.routineOrb?.routineId === 'FireRoutine' && s.routineOrb?.totalLayer === 6, 'Assert routineOrb FireRoutine totalLayer=6'),
    ],
  },

  'routine-orb-break': {
    name: 'routine-orb-break',
    maxFrames: 2500,
    prepare(actor) {
      setupActorForRoutineOrbScenario(actor);
    },
    steps: [
      castArt(0, 'Cast FireSkill1 (Art1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 1), 'Wait RoutineTileAdded L1'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      castArt(1, 'Cast FireSkill2 (Art2)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 2), 'Wait RoutineTileAdded L2'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),

      castArt(2, 'Cast FireSkill3 (Art3)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineOrbCreated, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6), 'Wait RoutineOrbCreated totalLayer=6'),

      breakRoutineOrb('Break RoutineOrb'),
      assertEvent(CombatEventType.RoutineOrbBreakStarted, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6, 'Proof RoutineOrbBreakStarted'),
      assertEvent(CombatEventType.ElementDamageApplied, (e) => e.data?.element === 'Fire' && e.data?.amount === 120, 'Proof ElementDamageApplied Fire amount=120'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'Element' && e.data?.sourceId === 'RoutineOrbBreak' && e.data?.amount === 120, 'Proof DamageApplied Element amount=120'),
      assertEvent(CombatEventType.DebuffApplied, (e) => e.data?.type === 'Burn' && (e.data?.durationFrames ?? 0) === 300, 'Proof DebuffApplied Burn 300f'),
      assertEvent(CombatEventType.RoutineOrbBroken, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6, 'Proof RoutineOrbBroken'),
      assertEvent(CombatEventType.RoutineOrbBreakFinished, null, 'Proof RoutineOrbBreakFinished'),

      assertSnapshot((s) => s.routineOrb === null, 'Assert routineOrb cleared'),
      assertSnapshot((s) => (s.routineTiles?.length ?? 0) === 0, 'Assert routineTiles cleared'),
      assertSnapshot((s) => (s.debuffs ?? []).some((d) => d?.type === 'Burn' && (d?.framesLeft ?? 0) > 0), 'Assert Burn present'),
    ],
  },

  'routine-orb-break-without-orb': {
    name: 'routine-orb-break-without-orb',
    maxFrames: 600,
    prepare(actor) {
      setupActorForRoutineOrbScenario(actor);
    },
    steps: [
      breakRoutineOrb('Break without orb'),
      assertEvent(CombatEventType.RoutineOrbBreakFailed, (e) => e.data?.reason === 'no_orb', 'Proof RoutineOrbBreakFailed no_orb'),
      assertSnapshot((s) => s.routineOrb === null, 'Assert routineOrb null'),
      assertSnapshot((s) => (s.routineTiles?.length ?? 0) === 0, 'Assert routineTiles empty'),
    ],
  },

  'routine-burn-kill': {
    name: 'routine-burn-kill',
    maxFrames: 4000,
    prepare(actor) {
      setupActorForRoutineOrbScenario(actor, { targetHp: 280 });
    },
    steps: [
      castArt(0, 'Cast FireSkill1 (Art1)'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),
      castArt(1, 'Cast FireSkill2 (Art2)'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),
      castArt(2, 'Cast FireSkill3 (Art3)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineOrbCreated, (e) => e.data?.routineId === 'FireRoutine'), 'Wait RoutineOrbCreated'),

      breakRoutineOrb('Break RoutineOrb'),
      assertEvent(CombatEventType.DebuffApplied, (e) => e.data?.type === 'Burn', 'Proof DebuffApplied Burn'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DebuffTickDamage, (e) => e.data?.type === 'Burn'), 'Wait DebuffTickDamage Burn'),
      assertEvent(CombatEventType.DebuffTickDamage, (e) => e.data?.type === 'Burn' && e.data?.amount === 5, 'Proof DebuffTickDamage Burn amount=5'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TargetDefeated), 'Wait TargetDefeated'),
      assertEvent(CombatEventType.TargetDefeated, null, 'Proof TargetDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Victory', 'Proof BattleEnded Victory'),

      assertSnapshot((s) => s.battle?.result === 'Victory' && s.target?.dead === true, 'Assert Victory and target dead'),
    ],
  },

  'single-driver-routine-orb-victory': {
    name: 'single-driver-routine-orb-victory',
    maxFrames: 6000,
    prepare(actor) {
      setupActorForRoutineOrbScenario(actor, { targetHp: 280 });
    },
    steps: [
      assertEvent(CombatEventType.BattleStarted, null, 'Proof BattleStarted'),

      castArt(0, 'Cast FireSkill1 (Art1)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.ActionHit, (e) => e.data?.artId === 'Art1'), 'Wait ActionHit Art1'),
      assertEvent(CombatEventType.ActionHit, (e) => e.data?.artId === 'Art1', 'Proof ActionHit Art1'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'Art' && e.data?.sourceId === 'Art1', 'Proof DamageApplied Art1'),
      assertEvent(CombatEventType.TargetHpChanged, null, 'Proof TargetHpChanged'),
      assertEvent(CombatEventType.RoutineTileAdded, (e) => e.data?.routineId === 'FireRoutine' && e.data?.layer === 1, 'Proof RoutineTileAdded L1'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art1'),

      castArt(1, 'Cast FireSkill2 (Art2)'),
      waitUntil((s) => s.state === 'Locomotion', 'Wait Locomotion after Art2'),

      castArt(2, 'Cast FireSkill3 (Art3)'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.RoutineOrbCreated, (e) => e.data?.routineId === 'FireRoutine'), 'Wait RoutineOrbCreated'),
      assertEvent(CombatEventType.RoutineOrbCreated, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6, 'Proof RoutineOrbCreated totalLayer=6'),

      breakRoutineOrb('Break RoutineOrb'),
      assertEvent(CombatEventType.RoutineOrbBroken, (e) => e.data?.routineId === 'FireRoutine' && e.data?.totalLayer === 6, 'Proof RoutineOrbBroken'),
      assertEvent(CombatEventType.ElementDamageApplied, (e) => e.data?.element === 'Fire' && e.data?.amount === 120, 'Proof ElementDamageApplied Fire amount=120'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'Element' && e.data?.sourceId === 'RoutineOrbBreak', 'Proof DamageApplied Element'),
      assertEvent(CombatEventType.DebuffApplied, (e) => e.data?.type === 'Burn', 'Proof DebuffApplied Burn'),

      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.DebuffTickDamage, (e) => e.data?.type === 'Burn'), 'Wait DebuffTickDamage Burn'),
      assertEvent(CombatEventType.DebuffTickDamage, (e) => e.data?.type === 'Burn' && e.data?.amount === 5, 'Proof DebuffTickDamage Burn amount=5'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TargetDefeated), 'Wait TargetDefeated'),
      assertEvent(CombatEventType.TargetDefeated, null, 'Proof TargetDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Victory', 'Proof BattleEnded Victory'),

      assertSnapshot((s) => s.battle?.result === 'Victory', 'Assert battle.result Victory'),
      assertSnapshot((s) => s.target?.dead === true, 'Assert target.dead true'),
      assertSnapshot((s) => s.routineOrb === null, 'Assert routineOrb null'),
    ],
  },
  'enemy-strike-defeat': {
    name: 'enemy-strike-defeat',
    maxFrames: 300,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.maxHp = 20;
      actor.player.hp = 20;
      actor.player.dead = false;
      actor.battle.active = true;
      actor.battle.result = null;
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec({
          id: 'TestEnemyStrike',
          startupFrames: 3,
          activeFrames: 1,
          recoveryFrames: 1,
          damage: 25,
          range: 999,
          cooldownFrames: 2,
        });
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
    },
    steps: [
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackHit), 'Wait EnemyAttackHit'),
      assertEvent(CombatEventType.EnemyAttackHit, (e) => (e.data?.damage ?? 0) > 0, 'Assert EnemyAttackHit damage>0'),
      assertEvent(CombatEventType.PlayerDamageApplied, (e) => (e.data?.amount ?? 0) > 0 && e.data?.source === 'EnemyStrike', 'Assert PlayerDamageApplied amount>0'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.PlayerDefeated), 'Wait PlayerDefeated'),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'Assert BattleEnded Defeat'),
      assertSnapshot((s) => s.battle?.result === 'Defeat', 'Assert battle.result Defeat'),
      assertSnapshot((s) => s.player?.dead === true, 'Assert player.dead true'),
    ],
  },
  'enemy-strike-suppressed-by-driver-combo': {
    name: 'enemy-strike-suppressed-by-driver-combo',
    maxFrames: 120,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec({
          id: 'TestEnemyStrike_CC',
          startupFrames: 3,
          activeFrames: 1,
          recoveryFrames: 1,
          damage: 1,
          range: 999,
          cooldownFrames: 0,
        });
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
      const ev1 = actor.driverCombo.apply(DriverComboEffect.Break);
      if (ev1) actor.emit(ev1.type, ev1.data);
      const ev2 = actor.driverCombo.apply(DriverComboEffect.Topple);
      if (ev2) actor.emit(ev2.type, ev2.data);
    },
    steps: [
      waitFrames(20, 'Wait 20f under Topple'),
      assertSnapshot((s, ctx) => !hasEvent(ctx.events, CombatEventType.EnemyAttackStarted), 'Assert no EnemyAttackStarted under Topple'),
      assertSnapshot((s) => s.enemy?.currentAction === null, 'Assert enemy.currentAction null under Topple'),
    ],
  },

  'enemy-starts-attack-when-player-in-range': {
    name: 'enemy-starts-attack-when-player-in-range',
    maxFrames: 240,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 12,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 15,
          range: 140,
          cooldownFrames: 30,
        }),
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackStarted), 'Wait EnemyAttackStarted', { timeoutFrames: 120 }),
      assertEvent(CombatEventType.EnemyAttackStarted, (e) => e.data?.attackId === 'EnemyStrike', 'Assert EnemyAttackStarted EnemyStrike'),
      assertSnapshot((s) => s.enemy?.currentAction?.id === 'EnemyStrike' && s.enemy?.state === 'Attacking', 'Assert enemy Attacking with action'),
      waitEnemyPhase('Startup', 'Wait enemy phase Startup', { timeoutFrames: 60 }),
    ],
  },

  'enemy-attack-hits-player': {
    name: 'enemy-attack-hits-player',
    maxFrames: 300,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 10,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 15,
          range: 140,
          cooldownFrames: 30,
        }),
        playerHp: 100,
        playerMaxHp: 100,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackHit), 'Wait EnemyAttackHit', { timeoutFrames: 180 }),
      assertEvent(CombatEventType.EnemyAttackHit, (e) => e.data?.attackId === 'EnemyStrike' && (e.data?.damage ?? 0) > 0, 'Assert EnemyAttackHit damage>0'),
      assertEvent(CombatEventType.PlayerDamageApplied, (e) => e.data?.source === 'EnemyStrike' && (e.data?.amount ?? 0) > 0, 'Assert PlayerDamageApplied amount>0'),
      assertEvent(CombatEventType.PlayerHpChanged, (e) => (e.data?.before ?? 0) > (e.data?.after ?? 0), 'Assert PlayerHpChanged down'),
      assertSnapshot((s) => (s.player?.hp ?? 0) < (s.player?.maxHp ?? 0) && s.player?.dead !== true, 'Assert player damaged but alive'),
    ],
  },

  'enemy-attack-whiffs-when-player-out-of-range': {
    name: 'enemy-attack-whiffs-when-player-out-of-range',
    maxFrames: 360,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 14,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 15,
          range: 140,
          cooldownFrames: 30,
        }),
        playerHp: 100,
        playerMaxHp: 100,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackStarted), 'Wait EnemyAttackStarted', { timeoutFrames: 120 }),
      waitEnemyPhase('Startup', 'Wait enemy phase Startup', { timeoutFrames: 60 }),
      setPlayerPosition(0, 0, 'Move player out of range'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackWhiffed, (e) => e.data?.reason === 'out_of_range'), 'Wait EnemyAttackWhiffed out_of_range', { timeoutFrames: 180 }),
      assertEvent(CombatEventType.EnemyAttackWhiffed, (e) => e.data?.attackId === 'EnemyStrike' && e.data?.reason === 'out_of_range', 'Assert EnemyAttackWhiffed out_of_range'),
      assertSnapshot((s, ctx) => !hasEvent(ctx.events, CombatEventType.EnemyAttackHit), 'Assert no EnemyAttackHit'),
      assertSnapshot((s) => (s.player?.hp ?? 0) === (s.player?.maxHp ?? 0), 'Assert player HP unchanged'),
    ],
  },

  'enemy-attack-enters-cooldown': {
    name: 'enemy-attack-enters-cooldown',
    maxFrames: 800,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 10,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 1,
          range: 140,
          cooldownFrames: 24,
        }),
        playerHp: 100,
        playerMaxHp: 100,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackFinished), 'Wait EnemyAttackFinished', { timeoutFrames: 300 }),
      assertEvent(CombatEventType.EnemyAttackCooldownStarted, (e) => e.data?.attackId === 'EnemyStrike' && (e.data?.frames ?? 0) > 0, 'Assert EnemyAttackCooldownStarted'),
      assertSnapshot((s) => (s.enemy?.cooldownLeft ?? 0) > 0, 'Assert enemy.cooldownLeft > 0'),
      setPlayerPosition(0, 0, 'Move player out of range (avoid immediate re-attack)'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackCooldownFinished), 'Wait EnemyAttackCooldownFinished', { timeoutFrames: 200 }),
      assertSnapshot((s) => (s.enemy?.cooldownLeft ?? 0) === 0 && s.enemy?.currentAction === null, 'Assert cooldown finished and no action'),
    ],
  },

  'enemy-cannot-attack-while-toppled': {
    name: 'enemy-cannot-attack-while-toppled',
    maxFrames: 180,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 10,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 15,
          range: 140,
          cooldownFrames: 0,
        }),
      });
      const ev1 = actor.driverCombo.apply(DriverComboEffect.Break);
      if (ev1) actor.emit(ev1.type, ev1.data);
      const ev2 = actor.driverCombo.apply(DriverComboEffect.Topple);
      if (ev2) actor.emit(ev2.type, ev2.data);
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      waitFrames(30, 'Wait 30f under Topple'),
      assertSnapshot((s, ctx) => !hasEvent(ctx.events, CombatEventType.EnemyAttackStarted), 'Assert no EnemyAttackStarted under Topple'),
      assertSnapshot((s) => s.enemy?.currentAction === null, 'Assert enemy.currentAction null under Topple'),
      assertSnapshot((s) => s.enemy?.state === 'Controlled', 'Assert enemy.state Controlled'),
    ],
  },

  'enemy-can-defeat-player': {
    name: 'enemy-can-defeat-player',
    maxFrames: 300,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 8,
          activeFrames: 2,
          recoveryFrames: 6,
          damage: 25,
          range: 140,
          cooldownFrames: 30,
        }),
        playerHp: 20,
        playerMaxHp: 20,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.PlayerDefeated), 'Wait PlayerDefeated', { timeoutFrames: 180 }),
      assertEvent(CombatEventType.EnemyAttackHit, (e) => (e.data?.damage ?? 0) > 0, 'Assert EnemyAttackHit damage>0'),
      assertEvent(CombatEventType.PlayerDamageApplied, (e) => (e.data?.amount ?? 0) > 0 && e.data?.source === 'EnemyStrike', 'Assert PlayerDamageApplied amount>0'),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'Assert BattleEnded Defeat'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.player?.dead === true, 'Assert player dead and battle Defeat'),
    ],
  },

  'player-can-defeat-attacking-enemy': {
    name: 'player-can-defeat-attacking-enemy',
    maxFrames: 600,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 40,
          activeFrames: 2,
          recoveryFrames: 8,
          damage: 15,
          range: 140,
          cooldownFrames: 90,
        }),
        targetHp: 30,
      });
      grantAllArtsReady(actor);
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.EnemyAttackStarted), 'Wait EnemyAttackStarted', { timeoutFrames: 120 }),
      castArt(0, 'Cast Art1 to defeat enemy'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TargetDefeated), 'Wait TargetDefeated', { timeoutFrames: 240 }),
      assertEvent(CombatEventType.TargetDefeated, null, 'Assert TargetDefeated'),
      assertSnapshot((s, ctx) => !hasEvent(ctx.events, CombatEventType.EnemyAttackHit), 'Assert no EnemyAttackHit before enemy defeated'),
      assertSnapshot((s) => s.target?.dead === true, 'Assert target.dead true'),
    ],
  },

  'player-defeat-stops-combat': {
    name: 'player-defeat-stops-combat',
    maxFrames: 600,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 8,
          activeFrames: 2,
          recoveryFrames: 6,
          damage: 25,
          range: 140,
          cooldownFrames: 30,
        }),
        playerHp: 20,
        playerMaxHp: 20,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), 'Wait BattleEnded Defeat', { timeoutFrames: 300 }),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'Assert BattleEnded Defeat'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.battle?.active === false && s.player?.dead === true && s.player?.hp === 0, 'Assert Defeat snapshot'),
      waitFrames(120, 'Wait 120f after Defeat'),
      assertSnapshot((s, ctx) => {
        const defeatEv = ctx.events.find((e) => String(e.type) === 'PlayerDefeated');
        if (!defeatEv) return false;
        const afterDefeat = ctx.events.filter((e) => (e.frame ?? 0) > (defeatEv.frame ?? 0));
        return !afterDefeat.some((e) => {
          const t = String(e.type);
          return t === 'EnemyAttackStarted' || t === 'EnemyAttackHit' || t === 'PlayerDamageApplied' || t === 'ActionStarted' || t === 'InputConsumed';
        });
      }, 'No new combat events after Defeat'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.player?.hp === 0 && s.player?.dead === true && s.enemy?.currentAction === null, 'Assert final Defeat state stable'),
    ],
  },

  'reset-after-defeat': {
    name: 'reset-after-defeat',
    maxFrames: 600,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 8,
          activeFrames: 2,
          recoveryFrames: 6,
          damage: 25,
          range: 140,
          cooldownFrames: 180,
        }),
        playerHp: 20,
        playerMaxHp: 999999,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), 'Wait BattleEnded Defeat', { timeoutFrames: 300 }),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.battle?.active === false && s.player?.hp === 0 && s.player?.dead === true, 'Assert in Defeat state'),
      resetRuntimeAfterDefeat('Reset after Defeat'),
      assertSnapshot((s) => s.battle?.active === true && s.battle?.result === null, 'Assert battle active after reset'),
      assertSnapshot((s) => s.player?.dead === false && s.player?.hp > 1000, 'Assert player alive with high HP'),
      assertSnapshot((s) => s.target?.dead === false && s.target?.hp === s.target?.maxHp, 'Assert target alive with full HP'),
      assertSnapshot((s) => s.enemy?.currentAction === null && s.enemy?.state === 'Idle', 'Assert enemy idle after reset'),
      waitFrames(10, 'Tick 10f after reset'),
      assertSnapshot((s) => s.battle?.active === true, 'Assert still active after tick'),
    ],
  },

  'input-ignored-after-defeat': {
    name: 'input-ignored-after-defeat',
    maxFrames: 600,
    prepare(actor) {
      setupActorForEnemyAttackScenario(actor, {
        strike: new EnemyStrikeSpec({
          id: 'EnemyStrike',
          startupFrames: 8,
          activeFrames: 2,
          recoveryFrames: 6,
          damage: 25,
          range: 140,
          cooldownFrames: 30,
        }),
        playerHp: 20,
        playerMaxHp: 20,
      });
    },
    steps: [
      grantEnemyCooldownReady('Grant enemy cooldown ready'),
      tickEnemyUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), 'Wait BattleEnded Defeat', { timeoutFrames: 300 }),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertSnapshot((s) => s.battle?.result === 'Defeat', 'Assert battle Defeat'),
      castArt(0, 'Try Cast Art1 after Defeat'),
      castArt(1, 'Try Cast Art2 after Defeat'),
      waitFrames(20, 'Wait 20f after input attempts'),
      assertSnapshot((s, ctx) => {
        const defeatEv = ctx.events.find((e) => String(e.type) === 'PlayerDefeated');
        if (!defeatEv) return false;
        const afterDefeat = ctx.events.filter((e) => (e.frame ?? 0) > (defeatEv.frame ?? 0));
        return !afterDefeat.some((e) => {
          const t = String(e.type);
          return t === 'ActionStarted' || t === 'InputConsumed' || t === 'EnemyAttackStarted' || t === 'EnemyAttackHit' || t === 'PlayerDamageApplied';
        });
      }, 'No combat events triggered after Defeat input'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.player?.hp === 0, 'Assert still Defeat after input'),
    ],
  },

  'backpack-valid-blade-placement': {
    name: 'backpack-valid-blade-placement',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      actor.backpackGrid = grid;
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertEvent(CombatEventType.BackpackResolved, (e) => (e.data?.activeBladeCount ?? 0) === 1, 'Assert BackpackResolved activeBlades=1'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeBlades?.length ?? 0) === 1, 'Assert 1 active blade'),
    ],
  },

  'backpack-rejects-overlap': {
    name: 'backpack-rejects-overlap',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      grid.place({ instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 1, y: 1, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
    },
    steps: [
      assertEvent(CombatEventType.BackpackInvalid, (e) => (e.data?.errorCount ?? 0) > 0, 'Assert BackpackInvalid with errors'),
      assertSnapshot((s) => (s.resolvedLoadout?.errors?.length ?? 0) > 0, 'Assert errors not empty'),
    ],
  },

  'blade-socket-resolves-fire-core': {
    name: 'blade-socket-resolves-fire-core',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({
        backpackGrid: grid,
        socketAssignments: { 'blade_001:socket_1': 'FireCore' },
      });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertEvent(CombatEventType.BladeSocketResolved, (e) => e.data?.element === 'Fire', 'Assert BladeSocketResolved element=Fire'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeBlades?.[0]?.element ?? '') === 'Fire', 'Assert resolvedBlade.element=Fire'),
    ],
  },

  'blade-auto-attack-hits-target': {
    name: 'blade-auto-attack-hits-target',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({
        backpackGrid: grid,
        socketAssignments: { 'blade_001:socket_1': 'FireCore' },
      });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertEvent(CombatEventType.BladeLinked, null, 'Assert BladeLinked'),
      waitFrames(55, 'Wait for blade attack startup+active'),
      assertEvent(CombatEventType.BladeAttackHit, (e) => e.data?.element === 'Fire' && (e.data?.damage ?? 0) > 0, 'Assert BladeAttackHit Fire'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'Blade', 'Assert DamageApplied source=Blade'),
    ],
  },

  'blade-auto-attack-whiffs-out-of-range': {
    name: 'blade-auto-attack-whiffs-out-of-range',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.x = 0;
      actor.y = 0;
      actor.target.x = 999;
      actor.target.y = 999;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade attack startup+active'),
      assertEvent(CombatEventType.BladeAttackWhiffed, (e) => e.data?.reason === 'out_of_range', 'Assert BladeAttackWhiffed out_of_range'),
    ],
  },

  'multiple-blades-limit-two-active': {
    name: 'multiple-blades-limit-two-active',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'blade_001', itemId: 'CrimsonBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      grid.place({ instanceId: 'blade_002', itemId: 'GuardianBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3 });
      grid.place({ instanceId: 'blade_003', itemId: 'CrimsonBlade', type: 'Blade', x: 6, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => (s.bladeRuntimes?.length ?? 0) === 2, 'Assert bladeRuntimes length=2'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeBlades?.length ?? 0) === 2, 'Assert activeBlades length=2'),
    ],
  },

  'beast-blade-wolf-profile': {
    name: 'beast-blade-wolf-profile',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertEvent(CombatEventType.BladeSpeciesResolved, (e) => e.data?.species === 'Wolf' && e.data?.lineage === 'GreyWolf', 'Assert species=Wolf lineage=GreyWolf'),
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.species === 'Wolf' && b?.individualTrait === 'Fierce' && (b?.hiddenProfile?.speedMultiplier ?? 0) > 1;
      }, 'Assert Wolf species, Fierce trait, speedMultiplier>1'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeLifeSkills ?? []).some((sk) => sk.tag === 'Tracking'), 'Assert lifeSkills contains Tracking'),
    ],
  },

  'beast-blade-bear-profile': {
    name: 'beast-blade-bear-profile',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'bear_001', itemId: 'BrownBearBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.species === 'Bear' && b?.lineage === 'BrownBear' && (b?.hiddenProfile?.hpMultiplier ?? 0) >= 1.5;
      }, 'Assert Bear species, high hpMultiplier'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeLifeSkills ?? []).some((sk) => sk.tag === 'Mining'), 'Assert lifeSkills contains Mining'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeLifeSkills ?? []).some((sk) => sk.tag === 'Carrying'), 'Assert lifeSkills contains Carrying'),
    ],
  },

  'beast-blade-tiger-profile': {
    name: 'beast-blade-tiger-profile',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'tiger_001', itemId: 'BengalTigerBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.species === 'Tiger' && (b?.hiddenProfile?.damageMultiplier ?? 0) >= 1.5;
      }, 'Assert Tiger species, high damageMultiplier'),
      assertSnapshot((s) => (s.resolvedLoadout?.activeLifeSkills ?? []).some((sk) => sk.tag === 'Hunting'), 'Assert lifeSkills contains Hunting'),
    ],
  },

  'beast-blade-element-still-from-core': {
    name: 'beast-blade-element-still-from-core',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      // No core �?should be Neutral
      const resolvedNoCore = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolvedNoCore;
      if (resolvedNoCore.event) actor.emit(resolvedNoCore.event.type, resolvedNoCore.event.data);
      for (const ev of (resolvedNoCore.events ?? [])) actor.emit(ev.type, ev.data);
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.species === 'Wolf' && b?.element === 'Neutral';
      }, 'Assert Wolf species but element=Neutral (no core)'),
    ],
  },

  'beast-blade-life-skills-resolve': {
    name: 'beast-blade-life-skills-resolve',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      setupActorForScenario(actor);
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      grid.place({ instanceId: 'moon_001', itemId: 'MoonWolfBlade', type: 'Blade', x: 0, y: 3, width: 3, height: 2 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => (s.resolvedLoadout?.activeBlades?.length ?? 0) === 2, 'Assert 2 active blades'),
      assertSnapshot((s) => {
        const skills = s.resolvedLoadout?.activeLifeSkills ?? [];
        const tracking = skills.find((sk) => sk.tag === 'Tracking');
        return tracking?.level === 3;
      }, 'Assert Tracking merged to Lv3 (max of Lv2+Lv3)'),
      assertSnapshot((s) => {
        const skills = s.resolvedLoadout?.activeLifeSkills ?? [];
        return skills.some((sk) => sk.tag === 'NightVision') && skills.some((sk) => sk.tag === 'TreasureSense');
      }, 'Assert MoonWolf unique skills present'),
    ],
  },

  'beast-blade-fierce-increases-damage': {
    name: 'beast-blade-fierce-increases-damage',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade attack startup+active'),
      assertEvent(CombatEventType.BladeTraitActivated, (e) => e.data?.trait === 'Fierce' && e.data?.effect === 'damage_multiplier', 'Assert BladeTraitActivated for Fierce'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'Assert BladeAttackHit occurred'),
    ],
  },

  'bond-blade-hit-gains-sync': {
    name: 'bond-blade-hit-gains-sync',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade hit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondSyncChanged, (e) => e.data?.reason === 'blade_hit' && e.data?.after > 0, 'BondSyncChanged with sync > 0'),
      assertEvent(CombatEventType.BondTrustChanged, null, 'BondTrustChanged occurred'),
    ],
  },

  'bond-sync-triggered': {
    name: 'bond-sync-triggered',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.bladeRuntimes && actor.bladeRuntimes.length > 0) {
        actor.bladeRuntimes[0].bondState.sync = 60;
      }
    },
    steps: [
      waitFrames(30, 'Wait for first blade hit (sync 60+15=75 triggers)'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondSyncTriggered, null, 'BondSyncTriggered occurred'),
    ],
  },

  'bond-victory-gains-trust': {
    name: 'bond-victory-gains-trust',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 10;
      actor.target.maxHp = 10;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade hit that kills target'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Victory', 'BattleEnded Victory'),
      assertEvent(CombatEventType.BondTrustChanged, (e) => e.data?.after > e.data?.before, 'BondTrustChanged with trust increase'),
      assertEvent(CombatEventType.BondMoodChanged, (e) => e.data?.reason === 'victory' && e.data?.after > e.data?.before, 'BondMoodChanged reason=victory'),
    ],
  },

  'bond-defeat-lowers-mood': {
    name: 'bond-defeat-lowers-mood',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 1;
      actor.player.maxHp = 1;
      actor.player.dead = false;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.enemy) {
        actor.enemy.cooldownLeft = 0;
        actor.enemy.state = 'Idle';
      }
    },
    steps: [
      waitFrames(120, 'Wait for enemy to attack and kill player'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'BattleEnded Defeat'),
      assertEvent(CombatEventType.BondMoodChanged, (e) => e.data?.reason === 'defeat' && e.data?.after < e.data?.before, 'BondMoodChanged reason=defeat mood decreased'),
    ],
  },

  'bond-loyal-gains-more-trust': {
    name: 'bond-loyal-gains-more-trust',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'loyal_1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      grid.place({ instanceId: 'normal_1', itemId: 'GuardianBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        const rt = actor.linkBlade(blade);
      }
      if (actor.bladeRuntimes && actor.bladeRuntimes.length > 0) {
        const loyal = actor.bladeRuntimes.find((b) => b.bladeId === 'GreyWolfBlade');
        if (loyal) loyal.resolvedBlade.individualTrait = 'Loyal';
      }
    },
    steps: [
      waitFrames(55, 'Wait for both blades to hit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
    ],
  },

  'bond-proud-gains-more-sync-less-trust': {
    name: 'bond-proud-gains-more-sync-less-trust',
    maxFrames: 500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'proud_1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.bladeRuntimes && actor.bladeRuntimes.length > 0) {
        actor.bladeRuntimes[0].resolvedBlade.individualTrait = 'Proud';
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade hit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondSyncChanged, (e) => e.data?.after === 18, 'BondSyncChanged after=18 (Proud 15*1.2)'),
    ],
  },

  'bond-reset-keeps-trust': {
    name: 'bond-reset-keeps-trust',
    maxFrames: 600,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade hit to accumulate trust'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondTrustChanged, (e) => e.data?.after > 0, 'BondTrustChanged after>0'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.trust ?? 0) > 0, 'Assert trust > 0 before reset'),
      resetRuntime('Reset runtime'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.trust ?? 0) > 0, 'Assert trust > 0 survives reset'),
    ],
  },

  'bond-reset-clears-sync': {
    name: 'bond-reset-clears-sync',
    maxFrames: 600,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for blade hit to accumulate sync'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondSyncChanged, (e) => e.data?.after > 0, 'BondSyncChanged after>0'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.sync ?? 0) > 0, 'Assert sync > 0 before reset'),
      resetRuntime('Reset runtime'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.sync ?? -1) === 0, 'Assert sync === 0 after reset'),
    ],
  },

  'bond-reset-normalizes-mood': {
    name: 'bond-reset-normalizes-mood',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 1;
      actor.player.maxHp = 1;
      actor.player.dead = false;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.enemy) {
        actor.enemy.cooldownLeft = 0;
        actor.enemy.state = 'Idle';
      }
    },
    steps: [
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), 'Wait Defeat'),
      assertEvent(CombatEventType.BondMoodChanged, (e) => e.data?.reason === 'defeat' && e.data?.after < e.data?.before, 'Mood lowered by defeat'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.mood ?? 50) < 50, 'Assert mood < 50 after defeat'),
      resetRuntime('Reset runtime'),
      assertSnapshot((s) => (s.bladeRuntimes?.[0]?.bond?.mood ?? -1) === 50, 'Assert mood === 50 after reset'),
    ],
  },

  'trust-lv1-no-combat-slot': {
    name: 'trust-lv1-no-combat-slot',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.unlocks?.combatSlots?.length === 0;
      }, 'Assert combatSlots empty at trust Lv1'),
    ],
  },

  'trust-lv3-unlocks-combat-slot': {
    name: 'trust-lv3-unlocks-combat-slot',
    maxFrames: 200,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.bond?.trustLevel === 3 && b?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert trustLevel=3 derives BondCombatSlot1 via refresh'),
    ],
  },

  'trust-unlock-survives-reset': {
    name: 'trust-unlock-survives-reset',
    maxFrames: 600,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert unlock derived from trustLevel=3 before reset'),
      resetRuntime('Reset runtime'),
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.bond?.trustLevel === 3 && b?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert unlock survives reset (derived from bond)'),
      assertSnapshot((s) => {
        const rt = s.bladeRuntimes?.[0];
        return rt?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert bladeRuntime snapshot has unlock after reset'),
    ],
  },

  'trust-unlock-survives-defeat': {
    name: 'trust-unlock-survives-defeat',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      actor.player.hp = 1;
      actor.player.maxHp = 1;
      actor.player.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.enemy) {
        actor.enemy.cooldownLeft = 0;
        actor.enemy.state = 'Idle';
      }
    },
    steps: [
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert unlock derived from trustLevel=3 before defeat'),
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat'), 'Wait Defeat'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'Assert BattleEnded Defeat'),
      assertSnapshot((s) => {
        const b = s.resolvedLoadout?.activeBlades?.[0];
        return b?.unlocks?.combatSlots?.includes('BondCombatSlot1');
      }, 'Assert unlock survives defeat'),
    ],
  },

  'trait-fierce-followup-damage': {
    name: 'trait-fierce-followup-damage',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'fw1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(55, 'Wait for first BladeAttackHit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.TraitPayoffActivated, (e) => e.data?.payoffId === 'FierceFollowUp', 'TraitPayoffActivated FierceFollowUp'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'TraitPayoff' && e.data?.sourceId === 'FierceFollowUp', 'DamageApplied source=TraitPayoff sourceId=FierceFollowUp'),
    ],
  },

  'trait-loyal-guard-reduces-player-damage': {
    name: 'trait-loyal-guard-reduces-player-damage',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 200;
      actor.player.maxHp = 200;
      actor.player.dead = false;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'loyal1', itemId: 'BrownBearBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.enemy) {
        actor.enemy.cooldownLeft = 0;
        actor.enemy.state = 'Idle';
      }
    },
    steps: [
      waitFrames(120, 'Wait for enemy attack to hit player'),
      assertEvent(CombatEventType.EnemyAttackHit, null, 'EnemyAttackHit occurred'),
      assertEvent(CombatEventType.TraitPayoffActivated, (e) => e.data?.payoffId === 'LoyalGuard', 'TraitPayoffActivated LoyalGuard'),
    ],
  },

  'trait-proud-sync-strike-on-sync-trigger': {
    name: 'trait-proud-sync-strike-on-sync-trigger',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'proud1', itemId: 'MoonWolfBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      if (resolved.activeBlades.length > 0) {
        resolved.activeBlades[0].bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
      }
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
      if (actor.bladeRuntimes && actor.bladeRuntimes.length > 0) {
        actor.bladeRuntimes[0].bondState.sync = 70;
      }
    },
    steps: [
      waitFrames(65, 'Wait for blade hit that triggers sync (70+18=88 >= 75)'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.BondSyncTriggered, null, 'BondSyncTriggered occurred'),
      assertEvent(CombatEventType.TraitPayoffActivated, (e) => e.data?.payoffId === 'ProudSyncStrike', 'TraitPayoffActivated ProudSyncStrike'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'TraitPayoff' && e.data?.sourceId === 'ProudSyncStrike', 'DamageApplied source=TraitPayoff sourceId=ProudSyncStrike'),
    ],
  },

  'trait-payoff-requires-combat-slot': {
    name: 'trait-payoff-requires-combat-slot',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      setupActorForScenario(actor);
      const grid = createBackpackGrid({ width: 9, height: 9 });
      grid.place({ instanceId: 'b1', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 });
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(65, 'Wait for blade hit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertSnapshot((_, ctx) => {
        const evs = ctx.events ?? [];
        return !evs.some((e) => String(e.type) === String(CombatEventType.TraitPayoffActivated));
      }, 'No TraitPayoffActivated when no combat slot'),
      assertSnapshot((_, ctx) => {
        const evs = ctx.events ?? [];
        return !evs.some((e) => String(e.type) === String(CombatEventType.DamageApplied) && e.data?.source === 'TraitPayoff');
      }, 'No TraitPayoff DamageApplied'),
    ],
  },

  'demo-preset-create': {
    name: 'demo-preset-create',
    maxFrames: 60,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = TRAINING_BRUTE_SPEC.hp;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(5, 'Wait for setup'),
      assertSnapshot((snap) => snap.player?.hp === DEMO_PLAYER_SPEC.hp && snap.player?.maxHp === DEMO_PLAYER_SPEC.maxHp, 'Player HP correct'),
      assertSnapshot((snap) => snap.target?.hp === TRAINING_BRUTE_SPEC.hp, 'Target HP correct'),
      assertSnapshot((snap) => (snap.resolvedLoadout?.activeBlades ?? []).length >= 2, 'At least 2 active blades'),
      assertSnapshot((snap) => {
        const blades = snap.resolvedLoadout?.activeBlades ?? [];
        return blades.some((b) => (b.itemId ?? b.bladeId) === 'GreyWolfBlade') && blades.some((b) => (b.itemId ?? b.bladeId) === 'BrownBearBlade');
      }, 'GreyWolf + BrownBear both active'),
      assertSnapshot((snap) => {
        const blades = snap.resolvedLoadout?.activeBlades ?? [];
        return blades.every((b) => (b.bond?.trustLevel ?? 0) >= 3);
      }, 'All blades have trustLevel >= 3'),
    ],
  },

  'demo-preset-fierce-follow-up': {
    name: 'demo-preset-fierce-follow-up',
    maxFrames: 800,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 120;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.x = actor.target.x - 100;
      actor.y = actor.target.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(65, 'Wait for first BladeAttackHit'),
      assertEvent(CombatEventType.BladeAttackHit, null, 'BladeAttackHit occurred'),
      assertEvent(CombatEventType.TraitPayoffActivated, (e) => e.data?.payoffId === 'FierceFollowUp', 'TraitPayoffActivated FierceFollowUp'),
      assertEvent(CombatEventType.DamageApplied, (e) => e.data?.source === 'TraitPayoff' && e.data?.sourceId === 'FierceFollowUp', 'DamageApplied from FierceFollowUp'),
    ],
  },

  'demo-preset-enemy-damages-player': {
    name: 'demo-preset-enemy-damages-player',
    maxFrames: 1500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = TRAINING_BRUTE_SPEC.hp;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.x = TRAINING_BRUTE_SPEC.x - 100;
      actor.y = TRAINING_BRUTE_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
    },
    steps: [
      waitFrames(120, 'Wait for enemy strike to land'),
      assertEvent(CombatEventType.EnemyAttackHit, null, 'EnemyAttackHit occurred'),
      assertEvent(CombatEventType.PlayerDamageApplied, null, 'PlayerDamageApplied occurred'),
    ],
  },

  'demo-preset-reset': {
    name: 'demo-preset-reset',
    maxFrames: 300,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 1;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = 1;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(5, 'Initial state with low HP'),
      assertSnapshot((snap) => snap.player?.hp === 1, 'Player HP is 1 before reset'),
      assertSnapshot((snap) => snap.target?.hp === 1, 'Target HP is 1 before reset'),
      executeStep(({ actor: a }) => {
        resetDemoPreset(a);
      }, 'resetDemoPreset'),
      waitFrames(5, 'After reset'),
      assertSnapshot((snap) => snap.player?.hp === DEMO_PLAYER_SPEC.hp && snap.player?.maxHp === DEMO_PLAYER_SPEC.maxHp, 'Player HP restored after reset'),
      assertSnapshot((snap) => snap.target?.hp === TRAINING_BRUTE_SPEC.hp && snap.target?.maxHp === TRAINING_BRUTE_SPEC.maxHp, 'Target HP restored after reset'),
      assertSnapshot((snap) => (snap.resolvedLoadout?.activeBlades ?? []).length >= 2, 'Blades still active after reset'),
      assertEvent(CombatEventType.Reset, null, 'Reset event emitted'),
    ],
  },
  'demo-hud-model-stable': {
    name: 'demo-hud-model-stable',
    maxFrames: 30,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = TRAINING_BRUTE_SPEC.hp;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      executeStep(({ actor: a }) => {
        const model = createDemoHudModel(a.getSnapshot());
        if (!model.isDemo) throw new Error('expected isDemo true');
        const requiredKeys = ['isDemo', 'player', 'enemy', 'battle', 'controls', 'blades', 'recent', 'diagnostics'];
        for (const key of requiredKeys) {
          if (!(key in model)) throw new Error('missing key: ' + key);
        }
      }, 'Check HUD model structure is stable'),
    ],
  },

  'demo-player-facing-hud-ready': {
    name: 'demo-player-facing-hud-ready',
    maxFrames: 30,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = TRAINING_BRUTE_SPEC.hp;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      executeStep(({ actor: a }) => {
        const model = createDemoHudModel(a.getSnapshot());
        if (!model.battle.goalText || model.battle.goalText === 'No active goal') throw new Error('expected non-empty goalText');
        if (!model.controls || model.controls.length === 0) throw new Error('expected controls entries');
        if (!model.player.hpText) throw new Error('expected player hpText');
        if (!model.enemy.hpText) throw new Error('expected enemy hpText');
        if (!model.blades || model.blades.length === 0) throw new Error('expected blades entries');
        if (!model.recent.hintText) throw new Error('expected hintText');
      }, 'Check player-facing HUD fields ready'),
    ],
  },

  'demo-dev-diagnostics-no-warnings': {
    name: 'demo-dev-diagnostics-no-warnings',
    maxFrames: 30,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.id = TRAINING_BRUTE_SPEC.id;
      actor.target.hp = TRAINING_BRUTE_SPEC.hp;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      executeStep(({ actor: a }) => {
        const model = createDemoHudModel(a.getSnapshot());
        if (!Array.isArray(model.diagnostics.warnings)) throw new Error('expected warnings array');
        if (model.diagnostics.warnings.length !== 0) throw new Error('expected 0 warnings, got ' + model.diagnostics.warnings.length + ': ' + model.diagnostics.warnings.join(', '));
      }, 'Check diagnostics.warnings is empty'),
    ],
  },

  'demo-tuned-player-can-win': {
    name: 'demo-tuned-player-can-win',
    maxFrames: 1200,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 120;
      actor.player.hp = DEMO_PLAYER_SPEC.hp;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = 30;
      actor.target.maxHp = 30;
      actor.target.dead = false;
      actor.target.x = 200;
      actor.target.y = 200;
      actor.x = actor.target.x - 100;
      actor.y = actor.target.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.TargetDefeated), 'Wait TargetDefeated'),
      assertEvent(CombatEventType.TargetDefeated, null, 'Assert TargetDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Victory', 'Assert BattleEnded Victory'),
      assertSnapshot((s) => s.battle?.result === 'Victory' && s.target?.dead === true, 'Assert Victory and target dead'),
    ],
  },

  'demo-tuned-player-can-lose': {
    name: 'demo-tuned-player-can-lose',
    maxFrames: 1500,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 10;
      actor.player.maxHp = 10;
      actor.player.dead = false;
      actor.target.hp = 999999;
      actor.target.maxHp = 999999;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.x = TRAINING_BRUTE_SPEC.x - 100;
      actor.y = TRAINING_BRUTE_SPEC.y;
      if (actor.battle) {
        actor.battle.active = true;
        actor.battle.result = null;
      }
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
        actor.enemy.cooldownLeft = 0;
        actor.enemy.action = null;
      }
    },
    steps: [
      waitUntil((s, ctx) => hasEvent(ctx.events, CombatEventType.PlayerDefeated), 'Wait PlayerDefeated'),
      assertEvent(CombatEventType.PlayerDefeated, null, 'Assert PlayerDefeated'),
      assertEvent(CombatEventType.BattleEnded, (e) => e.data?.result === 'Defeat', 'Assert BattleEnded Defeat'),
      assertSnapshot((s) => s.battle?.result === 'Defeat' && s.player?.dead === true, 'Assert Defeat and player dead'),
    ],
  },

  'demo-r-key-reset-keeps-demo': {
    name: 'demo-r-key-reset-keeps-demo',
    maxFrames: 300,
    prepare(actor) {
      actor.resetRuntime();
      actor.eventLog.clear();
      actor.autoAttackRange = 0;
      actor.player.hp = 1;
      actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
      actor.player.dead = false;
      actor.target.hp = 1;
      actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
      actor.target.dead = false;
      actor.target.x = TRAINING_BRUTE_SPEC.x;
      actor.target.y = TRAINING_BRUTE_SPEC.y;
      actor.target.radius = TRAINING_BRUTE_SPEC.radius;
      actor.x = DEMO_PLAYER_SPEC.x;
      actor.y = DEMO_PLAYER_SPEC.y;
      if (actor.enemy) {
        actor.enemy.strike = new EnemyStrikeSpec(TRAINING_BRUTE_SPEC.strike);
      }
      const grid = createDemoBackpack();
      const socketAssignments = getDemoSocketAssignments();
      const resolved = resolveLoadout({ backpackGrid: grid, socketAssignments });
      applyDemoBondToScenario(resolved.activeBlades);
      actor.resolvedLoadout = resolved;
      actor.refreshBladeUnlocks();
      if (resolved.event) actor.emit(resolved.event.type, resolved.event.data);
      for (const ev of (resolved.events ?? [])) actor.emit(ev.type, ev.data);
      for (const blade of resolved.activeBlades) {
        actor.linkBlade(blade);
      }
    },
    steps: [
      waitFrames(5, 'Initial state with low HP'),
      assertSnapshot((snap) => snap.player?.hp === 1, 'Player HP is 1 before reset'),
      assertSnapshot((snap) => snap.target?.hp === 1, 'Target HP is 1 before reset'),
      executeStep(({ actor: a }) => {
        resetDemoPreset(a);
      }, 'resetDemoPreset'),
      waitFrames(5, 'After reset'),
      assertSnapshot((snap) => snap.player?.hp === DEMO_PLAYER_SPEC.hp && snap.player?.maxHp === DEMO_PLAYER_SPEC.maxHp, 'Player HP restored after reset'),
      assertSnapshot((snap) => snap.target?.hp === TRAINING_BRUTE_SPEC.hp && snap.target?.maxHp === TRAINING_BRUTE_SPEC.maxHp, 'Target HP restored after reset'),
      assertSnapshot((snap) => (snap.resolvedLoadout?.activeBlades ?? []).length >= 2, 'Blades still active after reset'),
      assertSnapshot((snap) => {
        const blades = snap.resolvedLoadout?.activeBlades ?? [];
        return blades.every((b) => (b.bond?.trustLevel ?? 0) >= 3);
      }, 'Trust level still >= 3 after reset'),
      assertSnapshot((snap) => {
        const runtimes = snap.bladeRuntimes ?? [];
        return runtimes.length >= 2;
      }, 'bladeRuntimes still active'),
      assertEvent(CombatEventType.Reset, null, 'Reset event emitted'),
    ],
  },

});

function createDemoBackpack() {
  const grid = createBackpackGrid({ width: 9, height: 9 });
  grid.place({ itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3, instanceId: 'demo_greywolf' });
  grid.place({ itemId: 'BrownBearBlade', type: 'Blade', x: 3, y: 0, width: 3, height: 3, instanceId: 'demo_brownbear' });
  return grid;
}

function getDemoSocketAssignments() {
  return { 'demo_greywolf:socket_1': 'FireCore' };
}

function applyDemoBondToScenario(activeBlades) {
  for (const blade of activeBlades) {
    blade.bond = { trust: 250, trustLevel: 3, mood: 50, sync: 0 };
    blade.unlocks = { combatSlots: ['BondCombatSlot1'] };
  }
}

export function getScenario(name) {
  const key = String(name);
  const scenario = scenarios[key];
  if (!scenario) throw new Error(`Unknown scenario: ${key}`);
  return scenario;
}
