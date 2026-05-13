import { CombatActionInstance, CombatActionSpec } from './action.js';
import { ActionKind, ActionPhase, CombatEventType } from './enums.js';
import { distance } from './math.js';
import { createBondState, cloneBondState, computeBondModifiers, applyTrustGain, applySyncGain, DEFAULT_BOND_CONFIG } from './bond.js';

const DEFAULT_HIDDEN_PROFILE = Object.freeze({
  hpMultiplier: 1,
  damageMultiplier: 1,
  speedMultiplier: 1,
  cooldownMultiplier: 1,
  skillBudget: 0,
});

export class BladeRuntime {
  constructor(opts = {}) {
    let resolvedBlade = opts.resolvedBlade ?? null;

    if (!resolvedBlade) {
      resolvedBlade = {
        bladeInstanceId: opts.bladeInstanceId,
        bladeId: opts.bladeId,
        role: opts.role,
        element: opts.element ?? 'Neutral',
        damageBonus: opts.damageBonus ?? 0,
        hiddenProfile: opts.hiddenProfile ?? DEFAULT_HIDDEN_PROFILE,
        individualTrait: opts.individualTrait ?? null,
        species: opts.species ?? null,
        lineage: opts.lineage ?? null,
        rarity: opts.rarity ?? null,
        lifeSkills: opts.lifeSkills ?? null,
      };
    }

    if (!resolvedBlade.hiddenProfile) {
      resolvedBlade.hiddenProfile = DEFAULT_HIDDEN_PROFILE;
    }
    if (resolvedBlade.element == null) resolvedBlade.element = 'Neutral';
    if (resolvedBlade.damageBonus == null) resolvedBlade.damageBonus = 0;

    this.resolvedBlade = resolvedBlade;
    this.autoAttackSpec = opts.autoAttackSpec;
    this.state = 'Idle';
    this.action = null;
    this.cooldownLeft = 0;
    this._traitActivated = false;
    this._participated = false;

    if (resolvedBlade.bond) {
      this.bondState = cloneBondState(resolvedBlade.bond);
    } else {
      this.bondState = createBondState();
    }
    this._actionSpec = new CombatActionSpec({
      id: `BladeAuto_${resolvedBlade.bladeInstanceId}`,
      kind: ActionKind.AutoAttack,
      startupFrames: this.autoAttackSpec.startupFrames,
      activeFrames: this.autoAttackSpec.activeFrames,
      recoveryFrames: this.autoAttackSpec.recoveryFrames,
      damage: this.autoAttackSpec.damage,
      cancelRecoveryToMovement: false,
      cancelRecoveryToArt: false,
    });
  }

  get bladeInstanceId() { return this.resolvedBlade.bladeInstanceId; }
  get bladeId() { return this.resolvedBlade.bladeId; }
  get role() { return this.resolvedBlade.role; }
  get element() { return this.resolvedBlade.element; }
  get damageBonus() { return this.resolvedBlade.damageBonus; }
  get hiddenProfile() { return this.resolvedBlade.hiddenProfile; }
  get individualTrait() { return this.resolvedBlade.individualTrait; }
  get species() { return this.resolvedBlade.species; }
  get lineage() { return this.resolvedBlade.lineage; }
  get rarity() { return this.resolvedBlade.rarity; }
  get lifeSkills() { return this.resolvedBlade.lifeSkills; }

  tick({ target, actor } = {}) {
    const events = [];
    const dist = target ? distance({ x: actor.x, y: actor.y }, target) : Infinity;
    const inRange = dist <= (this.autoAttackSpec.range ?? 0);
    const rb = this.resolvedBlade;

    if (this.cooldownLeft > 0) {
      this.cooldownLeft -= 1;
      if (this.cooldownLeft === 0) {
        events.push({
          type: CombatEventType.BladeAttackCooldownFinished,
          data: { bladeId: rb.bladeId },
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
        data: { bladeId: rb.bladeId },
      });
      events.push({
        type: CombatEventType.BladeAttackPhaseChanged,
        data: { bladeId: rb.bladeId, before: ActionPhase.None, after: ActionPhase.Startup },
      });
    }

    if (this.state === 'Attacking' && this.action) {
      const before = this.action.phase;
      this.action.tick(1);
      const after = this.action.phase;

      if (before !== after) {
        events.push({
          type: CombatEventType.BladeAttackPhaseChanged,
          data: { bladeId: rb.bladeId, before, after },
        });
      }

      if (this.action.shouldFireHit()) {
        if (inRange) {
          const baseDamage = this.autoAttackSpec.damage ?? 0;
          let finalDamage = Math.round(baseDamage * rb.hiddenProfile.damageMultiplier * (1 + rb.damageBonus));
          if (rb.individualTrait === 'Fierce') {
            finalDamage = Math.round(finalDamage * 1.1);
            if (!this._traitActivated) {
              this._traitActivated = true;
              events.push({
                type: CombatEventType.BladeTraitActivated,
                data: {
                  bladeId: rb.bladeId,
                  trait: 'Fierce',
                  effect: 'damage_multiplier',
                },
              });
            }
          }
          events.push({
            type: CombatEventType.BladeAttackHit,
            data: {
              bladeId: rb.bladeId,
              element: rb.element,
              damage: finalDamage,
            },
          });

          this._participated = true;

          const modifiers = computeBondModifiers(this, DEFAULT_BOND_CONFIG);
          const config = DEFAULT_BOND_CONFIG;

          const trustAmount = Math.round(config.trustOnBladeHit * modifiers.trustMultiplier);
          const trustResult = applyTrustGain(this.bondState, trustAmount);
          events.push({
            type: CombatEventType.BondTrustChanged,
            data: {
              bladeId: rb.bladeId,
              before: trustResult.before,
              after: trustResult.after,
              beforeLevel: trustResult.beforeLevel,
              afterLevel: trustResult.afterLevel,
            },
          });

          const syncAmount = Math.round(config.syncOnBladeHit * modifiers.syncMultiplier);
          const { gainResult, triggeredResults } = applySyncGain(this.bondState, syncAmount, 'blade_hit', config);
          events.push({
            type: CombatEventType.BondSyncChanged,
            data: {
              bladeId: rb.bladeId,
              before: gainResult.before,
              after: gainResult.after,
              reason: gainResult.reason,
            },
          });

          for (const trig of triggeredResults) {
            events.push({
              type: CombatEventType.BondSyncTriggered,
              data: {
                bladeId: rb.bladeId,
                syncThreshold: trig.threshold,
                overflow: trig.overflow,
              },
            });
            events.push({
              type: CombatEventType.BondSyncChanged,
              data: {
                bladeId: rb.bladeId,
                before: trig.before,
                after: trig.after,
                reason: 'sync_triggered',
              },
            });
          }

          return {
            events,
            damageToApply: {
              amount: finalDamage,
              source: 'Blade',
              sourceId: rb.bladeId,
            },
          };
        } else {
          events.push({
            type: CombatEventType.BladeAttackWhiffed,
            data: { bladeId: rb.bladeId, reason: 'out_of_range' },
          });
        }
      }

      if (this.action.isFinished()) {
        events.push({
          type: CombatEventType.BladeAttackFinished,
          data: { bladeId: rb.bladeId },
        });
        this.action = null;
        const baseCooldown = this.autoAttackSpec.cooldownFrames ?? 0;
        this.cooldownLeft = Math.round(baseCooldown * rb.hiddenProfile.cooldownMultiplier);
        this.state = 'Cooldown';
        if (this.cooldownLeft > 0) {
          events.push({
            type: CombatEventType.BladeAttackCooldownStarted,
            data: { bladeId: rb.bladeId, frames: this.cooldownLeft },
          });
        } else {
          this.state = 'Idle';
        }
      }
    }

    return { events, damageToApply: null };
  }

  exportBondSnapshot({ resetBattleTransient = false } = {}) {
    const bs = this.bondState;
    if (resetBattleTransient) {
      return {
        trust: bs.trust,
        trustLevel: bs.trustLevel,
        mood: 50,
        sync: 0,
      };
    }
    return {
      trust: bs.trust,
      trustLevel: bs.trustLevel,
      mood: bs.mood,
      sync: bs.sync,
    };
  }

  getSnapshot() {
    const rb = this.resolvedBlade;
    const bs = this.bondState;
    return {
      bladeInstanceId: rb.bladeInstanceId,
      bladeId: rb.bladeId,
      role: rb.role,
      element: rb.element,
      state: this.state,
      currentAction: this.action ? {
        id: this.action.spec.id,
        phase: this.action.phase,
        elapsedFrames: this.action.elapsedFrames,
      } : null,
      cooldownLeft: this.cooldownLeft,
      species: rb.species,
      lineage: rb.lineage,
      rarity: rb.rarity,
      individualTrait: rb.individualTrait,
      hiddenProfile: rb.hiddenProfile ? { ...rb.hiddenProfile } : null,
      lifeSkills: rb.lifeSkills ? [...rb.lifeSkills] : null,
      bond: {
        trust: bs.trust,
        trustLevel: bs.trustLevel,
        mood: bs.mood,
        sync: bs.sync,
      },
    };
  }
}
