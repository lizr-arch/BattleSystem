import { ActionPhase } from './enums.js';
import { clamp01 } from './math.js';

export class CombatActionSpec {
  constructor({
    id,
    kind,
    startupFrames,
    activeFrames,
    recoveryFrames,
    damage = 0,
    artChargeGain = 0,
    cancelRecoveryToMovement = false,
    cancelRecoveryToArt = false
  }) {
    if (!id) throw new Error('CombatActionSpec requires id.');
    if (!kind) throw new Error(`CombatActionSpec ${id} requires kind.`);

    this.id = id;
    this.kind = kind;
    this.startupFrames = Math.max(0, startupFrames | 0);
    this.activeFrames = Math.max(0, activeFrames | 0);
    this.recoveryFrames = Math.max(0, recoveryFrames | 0);
    this.damage = damage;
    this.artChargeGain = artChargeGain;
    this.cancelRecoveryToMovement = Boolean(cancelRecoveryToMovement);
    this.cancelRecoveryToArt = Boolean(cancelRecoveryToArt);
    this.totalFrames = this.startupFrames + this.activeFrames + this.recoveryFrames;

    if (this.totalFrames <= 0) {
      throw new Error(`CombatActionSpec ${id} must have a positive total duration.`);
    }
  }

  phaseAt(elapsedFrames) {
    if (elapsedFrames < this.startupFrames) return ActionPhase.Startup;
    if (elapsedFrames < this.startupFrames + this.activeFrames) return ActionPhase.Active;
    if (elapsedFrames < this.totalFrames) return ActionPhase.Recovery;
    return ActionPhase.Finished;
  }

  canCancelToMovement(elapsedFrames) {
    return this.cancelRecoveryToMovement && this.phaseAt(elapsedFrames) === ActionPhase.Recovery;
  }

  canCancelToArt(elapsedFrames) {
    return this.cancelRecoveryToArt && this.phaseAt(elapsedFrames) === ActionPhase.Recovery;
  }
}

export class CombatActionInstance {
  constructor(spec) {
    this.spec = spec;
    this.elapsedFrames = 0;
    this.hitFired = false;
    this.lastPhase = ActionPhase.None;
  }

  get phase() {
    return this.spec.phaseAt(this.elapsedFrames);
  }

  get progress01() {
    return clamp01(this.elapsedFrames / this.spec.totalFrames);
  }

  tick(frames = 1) {
    this.elapsedFrames += frames;
  }

  shouldFireHit() {
    if (this.hitFired) return false;

    if (this.elapsedFrames >= this.spec.startupFrames) {
      this.hitFired = true;
      return true;
    }

    return false;
  }

  isFinished() {
    return this.phase === ActionPhase.Finished;
  }
}

export class AutoAttackChainSpec {
  constructor(stages) {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('AutoAttackChainSpec requires at least one stage.');
    }

    this.stages = stages;
  }

  getStage(index) {
    return this.stages[index];
  }

  getNextIndex(index) {
    return (index + 1) % this.stages.length;
  }

  get firstIndex() {
    return 0;
  }
}
