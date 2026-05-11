import { BladeComboElement, BladeComboStage, CombatEventType, DriverComboEffect, DriverComboStage } from '../core/enums.js';
import { assertEvent, assertSnapshot, castArt, castSpecial, grantSpecialReady, waitFrames, waitUntil } from './scenario-runner.js';

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

function hasEvent(events, type, predicate) {
  return events.some((e) => String(e.type) === String(type) && (!predicate || predicate(e)));
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
});

export function getScenario(name) {
  const key = String(name);
  const scenario = scenarios[key];
  if (!scenario) throw new Error(`Unknown scenario: ${key}`);
  return scenario;
}
