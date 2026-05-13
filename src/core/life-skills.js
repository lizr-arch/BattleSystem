export const LifeSkillTag = Object.freeze({
  Tracking: 'Tracking',
  Hunting: 'Hunting',
  Mining: 'Mining',
  Carrying: 'Carrying',
  Guarding: 'Guarding',
  NightVision: 'NightVision',
  TreasureSense: 'TreasureSense',
  Scouting: 'Scouting',
});

export function mergeLifeSkills(bladeLifeSkillsArrays) {
  if (!bladeLifeSkillsArrays || bladeLifeSkillsArrays.length === 0) {
    return [];
  }
  const merged = {};
  for (const skills of bladeLifeSkillsArrays) {
    if (!skills || skills.length === 0) continue;
    for (const entry of skills) {
      if (!entry || !entry.tag) continue;
      const existing = merged[entry.tag];
      const level = entry.level ?? 0;
      if (!existing || level > existing.level) {
        merged[entry.tag] = { tag: entry.tag, level };
      }
    }
  }
  return Object.values(merged).sort((a, b) => {
    if (a.tag < b.tag) return -1;
    if (a.tag > b.tag) return 1;
    return 0;
  });
}

export function getLifeSkillLevel(mergedSkills, tag) {
  if (!mergedSkills || !tag) return 0;
  for (const entry of mergedSkills) {
    if (entry.tag === tag) return entry.level ?? 0;
  }
  return 0;
}
