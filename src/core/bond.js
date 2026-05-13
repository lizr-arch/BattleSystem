export const DEFAULT_BOND_CONFIG = Object.freeze({
  trustOnVictory: 10,
  trustOnBladeHit: 1,
  moodOnVictory: 5,
  moodOnDefeat: -10,
  syncOnBladeHit: 15,
  syncOnDriverFollowUp: 25,
  syncThreshold: 75,
  syncDecayPerFrame: 0,
});

export const TRUST_THRESHOLDS = Object.freeze([
  0,
  100,
  250,
  500,
  900,
]);

export function recalcTrustLevel(trust) {
  for (let i = TRUST_THRESHOLDS.length - 1; i >= 0; i--) {
    if (trust >= TRUST_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function createBondState(overrides = {}) {
  const trust = overrides.trust ?? 0;
  return {
    trust,
    trustLevel: overrides.trustLevel ?? recalcTrustLevel(trust),
    mood: overrides.mood ?? 50,
    sync: overrides.sync ?? 0,
  };
}

export function cloneBondState(bond) {
  return {
    trust: bond.trust,
    trustLevel: bond.trustLevel,
    mood: bond.mood,
    sync: bond.sync,
  };
}

export function clampBondValues(bond) {
  bond.trust = Math.max(0, bond.trust);
  bond.trustLevel = Math.max(1, Math.min(5, bond.trustLevel));
  bond.mood = Math.max(0, Math.min(100, bond.mood));
  bond.sync = Math.max(0, Math.min(100, bond.sync));
  return bond;
}

export function applyTrustGain(bond, amount) {
  const before = bond.trust;
  const beforeLevel = bond.trustLevel;
  bond.trust = Math.max(0, bond.trust + amount);
  bond.trustLevel = recalcTrustLevel(bond.trust);
  return {
    before,
    after: bond.trust,
    beforeLevel,
    afterLevel: bond.trustLevel,
  };
}

export function applyMoodChange(bond, amount, reason) {
  const before = bond.mood;
  bond.mood = Math.max(0, Math.min(100, bond.mood + amount));
  return {
    before,
    after: bond.mood,
    reason,
  };
}

export function applySyncGain(bond, amount, reason, config) {
  const threshold = config?.syncThreshold ?? 75;
  const before = bond.sync;
  bond.sync = Math.min(100, bond.sync + amount);
  const gainResult = {
    before,
    after: bond.sync,
    reason,
  };
  const triggeredResults = [];
  while (bond.sync >= threshold) {
    const overflow = bond.sync - threshold;
    bond.sync = 0;
    triggeredResults.push({
      threshold,
      overflow,
      before: bond.sync + threshold,
      after: bond.sync,
    });
  }
  return { gainResult, triggeredResults };
}

export function computeBondModifiers(bladeRuntime, config) {
  const trait = bladeRuntime.individualTrait ?? null;
  const result = {
    trustMultiplier: 1,
    syncMultiplier: 1,
    extraTrustOnVictory: 0,
  };
  if (trait === 'Loyal') {
    result.trustMultiplier = 2;
    result.extraTrustOnVictory = 5;
  }
  if (trait === 'Proud') {
    result.trustMultiplier = 0.8;
    result.syncMultiplier = 1.2;
  }
  return result;
}
