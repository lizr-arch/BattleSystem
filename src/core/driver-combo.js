import { CombatEventType, DriverComboEffect, DriverComboStage } from './enums.js';

export const DriverComboStageDurationFrames = Object.freeze({
  [DriverComboStage.None]: 0,
  [DriverComboStage.Break]: 180,
  [DriverComboStage.Topple]: 150,
  [DriverComboStage.Launch]: 120,
});

export function getDriverComboDurationFrames(stage) {
  return DriverComboStageDurationFrames[stage] ?? 0;
}

function createEvent(type, data) {
  return { type, data };
}

function expectedEffectForStage(stage) {
  switch (stage) {
    case DriverComboStage.None:
      return DriverComboEffect.Break;
    case DriverComboStage.Break:
      return DriverComboEffect.Topple;
    case DriverComboStage.Topple:
      return DriverComboEffect.Launch;
    case DriverComboStage.Launch:
      return DriverComboEffect.Smash;
    default:
      return null;
  }
}

function stageForEffect(effect) {
  switch (effect) {
    case DriverComboEffect.Break:
      return DriverComboStage.Break;
    case DriverComboEffect.Topple:
      return DriverComboStage.Topple;
    case DriverComboEffect.Launch:
      return DriverComboStage.Launch;
    default:
      return null;
  }
}

export class DriverComboState {
  constructor({ stage = DriverComboStage.None, framesLeft = 0 } = {}) {
    this.stage = stage;
    this.framesLeft = Math.max(0, framesLeft | 0);
  }

  tick(frames = 1) {
    const n = Math.max(0, frames | 0);
    if (n <= 0) return null;
    if (this.stage === DriverComboStage.None) return null;
    if (this.framesLeft <= 0) return this.expire({ reason: 'zero' });

    const before = this.framesLeft;
    this.framesLeft = Math.max(0, this.framesLeft - n);

    if (before > 0 && this.framesLeft === 0) {
      return this.expire({ reason: 'timeout' });
    }

    return null;
  }

  apply(effect) {
    if (this.stage === DriverComboStage.Break && effect === DriverComboEffect.Break) {
      return this.refresh({ effect, stage: DriverComboStage.Break });
    }

    const expected = expectedEffectForStage(this.stage);
    if (expected === null) {
      return createEvent(CombatEventType.DriverComboFailed, {
        stage: this.stage,
        effect,
        requires: DriverComboEffect.Break,
        reason: 'invalid_stage',
      });
    }

    if (effect !== expected) {
      return createEvent(CombatEventType.DriverComboFailed, {
        stage: this.stage,
        effect,
        requires: expected,
        reason: 'wrong_order',
      });
    }

    if (effect === DriverComboEffect.Smash) {
      return this.finish({ effect });
    }

    const toStage = stageForEffect(effect);
    if (toStage === null) {
      return createEvent(CombatEventType.DriverComboFailed, {
        stage: this.stage,
        effect,
        requires: expected,
        reason: 'invalid_effect',
      });
    }

    if (this.stage === DriverComboStage.None) {
      return this.applyStage({ effect, stage: toStage });
    }

    return this.advance({ effect, toStage });
  }

  applyStage({ effect, stage }) {
    const duration = getDriverComboDurationFrames(stage);
    this.stage = stage;
    this.framesLeft = duration;
    return createEvent(CombatEventType.DriverComboApplied, {
      stage,
      duration,
      framesLeft: this.framesLeft,
      effect,
    });
  }

  advance({ effect, toStage }) {
    const fromStage = this.stage;
    const duration = getDriverComboDurationFrames(toStage);
    this.stage = toStage;
    this.framesLeft = duration;
    return createEvent(CombatEventType.DriverComboAdvanced, {
      fromStage,
      toStage,
      duration,
      framesLeft: this.framesLeft,
      effect,
    });
  }

  refresh({ effect, stage = this.stage }) {
    const duration = getDriverComboDurationFrames(stage);
    const before = this.framesLeft;
    this.stage = stage;
    this.framesLeft = duration;
    return createEvent(CombatEventType.DriverComboRefreshed, {
      stage,
      duration,
      beforeFramesLeft: before,
      framesLeft: this.framesLeft,
      effect,
    });
  }

  expire({ reason = 'timeout' } = {}) {
    const stage = this.stage;
    this.stage = DriverComboStage.None;
    this.framesLeft = 0;
    return createEvent(CombatEventType.DriverComboExpired, { stage, reason });
  }

  finish({ effect = DriverComboEffect.Smash } = {}) {
    const stage = this.stage;
    this.stage = DriverComboStage.None;
    this.framesLeft = 0;
    return createEvent(CombatEventType.DriverComboFinished, { stage, effect });
  }
}
