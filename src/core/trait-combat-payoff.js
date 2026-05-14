export function hasCombatSlot(bladeOrRuntime, slotId = 'BondCombatSlot1') {
  const unlocks = bladeOrRuntime?.resolvedBlade?.unlocks ?? bladeOrRuntime?.unlocks ?? null;
  if (!unlocks || !Array.isArray(unlocks.combatSlots)) return false;
  return unlocks.combatSlots.includes(slotId);
}

export function resolveTraitCombatPayoff({
  trait,
  unlocks,
  context,
  baseAmount,
  bond,
} = {}) {
  if (!trait) return null;
  const combatSlots = unlocks?.combatSlots ?? [];
  if (!combatSlots.includes('BondCombatSlot1')) return null;

  switch (context) {
    case 'blade_hit': {
      if (trait === 'Fierce') {
        const followUpDamage = Math.round((baseAmount ?? 0) * 0.15);
        return {
          payoffId: 'FierceFollowUp',
          trait: 'Fierce',
          context: 'blade_hit',
          damage: followUpDamage,
        };
      }
      break;
    }
    case 'sync_triggered': {
      if (trait === 'Proud') {
        const syncStrikeDamage = Math.round((baseAmount ?? 0) * 0.10);
        return {
          payoffId: 'ProudSyncStrike',
          trait: 'Proud',
          context: 'sync_triggered',
          damage: syncStrikeDamage,
        };
      }
      break;
    }
    default:
      break;
  }

  return null;
}

export function resolveLoyalGuard({ bladeRuntimes, incomingDamage } = {}) {
  if (!bladeRuntimes || bladeRuntimes.length === 0) {
    return { finalDamage: incomingDamage, events: [] };
  }

  let loyalBlade = null;
  for (const runtime of bladeRuntimes) {
    if (!runtime.individualTrait) continue;
    if (runtime.individualTrait !== 'Loyal') continue;
    if (!hasCombatSlot(runtime, 'BondCombatSlot1')) continue;
    loyalBlade = runtime;
    break;
  }

  if (!loyalBlade) {
    return { finalDamage: incomingDamage, events: [] };
  }

  const finalDamage = Math.round(incomingDamage * 0.85);
  const reducedAmount = incomingDamage - finalDamage;

  const events = [{
    type: 'TraitPayoffActivated',
    data: {
      bladeId: loyalBlade.bladeInstanceId ?? loyalBlade.resolvedBlade?.bladeInstanceId ?? '?',
      trait: 'Loyal',
      payoffId: 'LoyalGuard',
      beforeAmount: incomingDamage,
      afterAmount: finalDamage,
      reducedAmount,
    },
  }];

  return { finalDamage, events };
}
