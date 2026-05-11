export const SkillTraitType = Object.freeze({
  Reserved: 'Reserved',
  HpDamage: 'HpDamage',
  HpDot: 'HpDot',
});

export function createHpDamageTrait(amount) {
  return { type: SkillTraitType.HpDamage, amount: Number(amount) | 0 };
}

export function createHpDotTrait({ debuffType = null, durationFrames = 0, tickEveryFrames = 0, tickDamage = 0 } = {}) {
  return {
    type: SkillTraitType.HpDot,
    debuffType,
    durationFrames: Number(durationFrames) | 0,
    tickEveryFrames: Number(tickEveryFrames) | 0,
    tickDamage: Number(tickDamage) | 0,
  };
}

