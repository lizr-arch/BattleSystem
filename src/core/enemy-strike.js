import { CombatActionSpec } from './action.js';
import { ActionKind, EnemyState } from './enums.js';

export class EnemyStrikeSpec {
  constructor({
    id,
    startupFrames,
    activeFrames,
    recoveryFrames,
    damage,
    range,
    cooldownFrames,
  }) {
    if (!id) throw new Error('EnemyStrikeSpec requires id.');

    const actionSpec = new CombatActionSpec({
      id,
      kind: ActionKind.EnemyStrike,
      startupFrames,
      activeFrames,
      recoveryFrames,
      damage,
      artChargeGain: 0,
      cancelRecoveryToMovement: false,
      cancelRecoveryToArt: false,
    });

    this.id = id;
    this.actionSpec = actionSpec;
    this.damage = Number(damage) | 0;
    this.range = Math.max(0, Number(range) || 0);
    this.cooldownFrames = Math.max(0, Number(cooldownFrames) | 0);
  }
}

export class EnemyRuntimeState {
  constructor({
    id = null,
    enemyId = null,
    targetId = 'Player',
    state = EnemyState.Idle,
    strike = null,
    cooldownLeft = 0,
    action = null,
  } = {}) {
    const resolvedId = id ?? enemyId ?? 'Enemy';
    this.id = String(resolvedId);
    this.enemyId = this.id;
    this.targetId = String(targetId);
    this.state = state;
    this.targetSelectedEmitted = false;
    this.strike = strike;
    this.cooldownLeft = Math.max(0, Number(cooldownLeft) | 0);
    this.initialCooldownLeft = this.cooldownLeft;
    this.action = action;
  }

  reset() {
    this.cooldownLeft = this.initialCooldownLeft;
    this.action = null;
    this.state = EnemyState.Idle;
    this.targetSelectedEmitted = false;
  }
}
