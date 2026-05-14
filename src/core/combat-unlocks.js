export function resolveCombatUnlocks({ bond } = {}) {
  const trustLevel = bond?.trustLevel ?? 1;
  const unlocks = {
    combatSlots: [],
    traitBoosts: [],
  };

  if (trustLevel >= 3) {
    unlocks.combatSlots.push('BondCombatSlot1');
  }

  return unlocks;
}
