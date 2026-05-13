export const BeastBladeSpecies = Object.freeze({
  Wolf: 'Wolf',
  Bear: 'Bear',
  Tiger: 'Tiger',
});

export const BeastBladeLineage = Object.freeze({
  GreyWolf: 'GreyWolf',
  MoonWolf: 'MoonWolf',
  BrownBear: 'BrownBear',
  BengalTiger: 'BengalTiger',
});

export const BeastBladeRarity = Object.freeze({
  Common: 'Common',
  Uncommon: 'Uncommon',
  Rare: 'Rare',
  Legendary: 'Legendary',
});

export const IndividualTrait = Object.freeze({
  Loyal: 'Loyal',
  Fierce: 'Fierce',
  Proud: 'Proud',
});

const SPECIES_BASE = Object.freeze({
  Wolf: Object.freeze({ hpMultiplier: 0.9, damageMultiplier: 1.3, speedMultiplier: 1.4, cooldownMultiplier: 0.9, skillBudget: 6 }),
  Bear: Object.freeze({ hpMultiplier: 1.8, damageMultiplier: 1.4, speedMultiplier: 0.6, cooldownMultiplier: 1.8, skillBudget: 3 }),
  Tiger: Object.freeze({ hpMultiplier: 1.2, damageMultiplier: 1.5, speedMultiplier: 1.1, cooldownMultiplier: 1.3, skillBudget: 5 }),
});

const LINEAGE_ADJUST = Object.freeze({
  GreyWolf: Object.freeze({ hpMultiplier: 0, damageMultiplier: 0, speedMultiplier: 0, cooldownMultiplier: 0, skillBudget: 0 }),
  MoonWolf: Object.freeze({ hpMultiplier: 0.05, damageMultiplier: 0.05, speedMultiplier: 0.1, cooldownMultiplier: -0.1, skillBudget: 2 }),
  BrownBear: Object.freeze({ hpMultiplier: 0, damageMultiplier: 0, speedMultiplier: 0, cooldownMultiplier: 0, skillBudget: 0 }),
  BengalTiger: Object.freeze({ hpMultiplier: 0, damageMultiplier: 0, speedMultiplier: 0, cooldownMultiplier: 0, skillBudget: 0 }),
});

const RARITY_DAMAGE_MULT = Object.freeze({
  Common: 1.0,
  Uncommon: 1.05,
  Rare: 1.10,
  Legendary: 1.15,
});

export function getSpeciesLineageProfile(species, lineage) {
  const base = SPECIES_BASE[species];
  if (!base) return null;
  const adj = LINEAGE_ADJUST[lineage] ?? { hpMultiplier: 0, damageMultiplier: 0, speedMultiplier: 0, cooldownMultiplier: 0, skillBudget: 0 };
  return {
    hpMultiplier: Math.round((base.hpMultiplier + adj.hpMultiplier) * 100) / 100,
    damageMultiplier: Math.round((base.damageMultiplier + adj.damageMultiplier) * 100) / 100,
    speedMultiplier: Math.round((base.speedMultiplier + adj.speedMultiplier) * 100) / 100,
    cooldownMultiplier: Math.round((base.cooldownMultiplier + adj.cooldownMultiplier) * 100) / 100,
    skillBudget: base.skillBudget + adj.skillBudget,
  };
}

export function resolveBeastBladeProfile({ species, lineage, rarity } = {}) {
  const base = getSpeciesLineageProfile(species, lineage);
  if (!base) return null;
  const rarityMult = RARITY_DAMAGE_MULT[rarity] ?? 1.0;
  return {
    hpMultiplier: base.hpMultiplier,
    damageMultiplier: Math.round(base.damageMultiplier * rarityMult * 100) / 100,
    speedMultiplier: base.speedMultiplier,
    cooldownMultiplier: base.cooldownMultiplier,
    skillBudget: base.skillBudget,
  };
}

export function isBeastBlade(definition) {
  return !!(definition && definition.species && definition.lineage && definition.rarity);
}
