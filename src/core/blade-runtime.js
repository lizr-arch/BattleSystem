import { CombatActionInstance, CombatActionSpec } from './action.js';
import { ActionKind, ActionPhase, CombatEventType } from './enums.js';
import { distance } from './math.js';

export class BladeRuntime {
  constructor({
    bladeInstanceId,
    bladeId,
    role,
    element = 'Neutral',
    damageBonus = 0,
    autoAttackSpec,
    hiddenProfile = null,
    individualTrait = null,
    species = null,
    lineage = null,
    rarity = null,
    lifeSkills = null,
  }) {
    this.bladeInstanceId = bladeInstanceId;
    this.bladeId = bladeId;
    this.role = role;
    this.element = element;
    this.damageBonus = damageBonus;
    this.autoAttackSpec = autoAttackSpec;
    this.hiddenProfile = hiddenProfile ?? { hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1, skillBudget: 0 };
    this.individualTrait = individualTrait ?? null;
    this.species = species ?? null;
    this.lineage = lineage ?? null;
    this.rarity = rarity ?? null;
    this.lifeSkills = lifeSkills ?? null;
    this.state = 'Idle';
    this.action = null;
    this.cooldownLeft = 0;
    this._traitActivated = false;
    this._actionSpec = new CombatActionSpec({
      id: `BladeAuto_${bladeInstanceId}`,
      kind: ActionKind.AutoAttack,
      startupFrames: autoAttackSpec.startupFrames,
      activeFrames: autoAttackSpec.activeFrames,
      recoveryFrames: autoAttackSpec.recoveryFrames,
      damage: autoAttackSpec.damage,
      cancelRecoveryToMovement: false,
      cancelRecoveryToArt: false,
    });
  }

  // V5.1: Blade follows Driver; attack range measured from Driver position (actor.x/actor.y)
  tick({ target, actor } = {}) {
    const events = [];
    const dist = target ? distance({ x: actor.x, y: actor.y }, target) : Infinity;
    const inRange = dist <= (this.autoAttackSpec.range ?? 0);

    if (this.cooldownLeft > 0) {
      this.cooldownLeft -= 1;
      if (this.cooldownLeft === 0) {
        events.push({
          type: CombatEventType.BladeAttackCooldownFinished,
          data: { bladeId: this.bladeId },
        });
        this.state = 'Idle';
      }
      return { events, damageToApply: null };
    }

    if (this.state === 'Idle' && inRange && this.cooldownLeft === 0) {
      this.action = new CombatActionInstance(this._actionSpec);
      this.state = 'Attacking';
      events.push({
        type: CombatEventType.BladeAttackStarted,
        data: { bladeId: this.bladeId },
      });
      events.push({
        type: CombatEventType.BladeAttackPhaseChanged,
        data: { bladeId: this.bladeId, before: ActionPhase.None, after: ActionPhase.Startup },
      });
    }

    if (this.state === 'Attacking' && this.action) {
      const before = this.action.phase;
      this.action.tick(1);
      const after = this.action.phase;

      if (before !== after) {
        events.push({
          type: CombatEventType.BladeAttackPhaseChanged,
          data: { bladeId: this.bladeId, before, after },
        });
      }

      if (this.action.shouldFireHit()) {
        if (inRange) {
          const baseDamage = this.autoAttackSpec.damage ?? 0;
          let finalDamage = Math.round(baseDamage * this.hiddenProfile.damageMultiplier * (1 + this.damageBonus));
          if (this.individualTrait === 'Fierce') {
            finalDamage = Math.round(finalDamage * 1.1);
            if (!this._traitActivated) {
              this._traitActivated = true;
              events.push({
                type: CombatEventType.BladeTraitActivated,
                data: {
                  bladeId: this.bladeId,
                  trait: 'Fierce',
                  effect: 'damage_multiplier',
                },
              });
            }
          }
          events.push({
            type: CombatEventType.BladeAttackHit,
            data: {
              bladeId: this.bladeId,
              element: this.element,
              damage: finalDamage,
            },
          });
          return {
            events,
            damageToApply: {
              amount: finalDamage,
              source: 'Blade',
              sourceId: this.bladeId,
            },
          };
        } else {
          events.push({
            type: CombatEventType.BladeAttackWhiffed,
            data: { bladeId: this.bladeId, reason: 'out_of_range' },
          });
        }
      }

      if (this.action.isFinished()) {
        events.push({
          type: CombatEventType.BladeAttackFinished,
          data: { bladeId: this.bladeId },
        });
        this.action = null;
        const baseCooldown = this.autoAttackSpec.cooldownFrames ?? 0;
        this.cooldownLeft = Math.round(baseCooldown * this.hiddenProfile.cooldownMultiplier);
        this.state = 'Cooldown';
        if (this.cooldownLeft > 0) {
          events.push({
            type: CombatEventType.BladeAttackCooldownStarted,
            data: { bladeId: this.bladeId, frames: this.cooldownLeft },
          });
        } else {
          this.state = 'Idle';
        }
      }
    }

    return { events, damageToApply: null };
  }

  getSnapshot() {
    return {
      bladeInstanceId: this.bladeInstanceId,
      bladeId: this.bladeId,
      role: this.role,
      element: this.element,
      state: this.state,
      currentAction: this.action ? {
        id: this.action.spec.id,
        phase: this.action.phase,
        elapsedFrames: this.action.elapsedFrames,
      } : null,
      cooldownLeft: this.cooldownLeft,
      species: this.species,
      lineage: this.lineage,
      rarity: this.rarity,
      individualTrait: this.individualTrait,
      hiddenProfile: this.hiddenProfile ? { ...this.hiddenProfile } : null,
      lifeSkills: this.lifeSkills ? [...this.lifeSkills] : null,
    };
  }
}
