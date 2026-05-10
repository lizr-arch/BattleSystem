import { CombatEventType, DriverComboEffect, DriverComboStage } from '../core/enums.js';
import { assertEvent, assertSnapshot, castArt, waitFrames, waitUntil } from './scenario-runner.js';

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
});

export function getScenario(name) {
  const key = String(name);
  const scenario = scenarios[key];
  if (!scenario) throw new Error(`Unknown scenario: ${key}`);
  return scenario;
}
