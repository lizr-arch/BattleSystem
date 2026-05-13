import assert from 'node:assert/strict';

import {
  BeastBladeSpecies,
  BeastBladeLineage,
  BeastBladeRarity,
  IndividualTrait,
  resolveBeastBladeProfile,
  getSpeciesLineageProfile,
} from '../src/core/beast-blade.js';
import { getItemDefinition } from '../src/core/backpack-items.js';
import { resolveLoadout } from '../src/core/loadout-resolver.js';
import { createBackpackGrid } from '../src/core/backpack-grid.js';
import { mergeLifeSkills, getLifeSkillLevel } from '../src/core/life-skills.js';
import { CombatEventType } from '../src/core/enums.js';

function makeGridWith(items) {
  const g = createBackpackGrid({ width: 9, height: 9 });
  for (const item of items) {
    g.place(item);
  }
  return g;
}

// Test 1: Wolf/Bear/Tiger 物种定义存在
{
  assert.strictEqual(BeastBladeSpecies.Wolf, 'Wolf');
  assert.strictEqual(BeastBladeSpecies.Bear, 'Bear');
  assert.strictEqual(BeastBladeSpecies.Tiger, 'Tiger');
  console.log('PASS: Wolf/Bear/Tiger species definitions exist');
}

// Test 2: GreyWolf/MoonWolf 品系存在
{
  assert.strictEqual(BeastBladeLineage.GreyWolf, 'GreyWolf');
  assert.strictEqual(BeastBladeLineage.MoonWolf, 'MoonWolf');
  assert.strictEqual(BeastBladeLineage.BrownBear, 'BrownBear');
  assert.strictEqual(BeastBladeLineage.BengalTiger, 'BengalTiger');
  console.log('PASS: GreyWolf/MoonWolf/BrownBear/BengalTiger lineages exist');
}

// Test 3: GreyWolf 的 hiddenProfile 正确
{
  const profile = resolveBeastBladeProfile({
    species: 'Wolf', lineage: 'GreyWolf', rarity: 'Common',
  });
  assert.ok(profile, 'profile should not be null');
  assert.strictEqual(profile.hpMultiplier, 0.9);
  assert.strictEqual(profile.damageMultiplier, 1.3);
  assert.strictEqual(profile.speedMultiplier, 1.4);
  assert.strictEqual(profile.cooldownMultiplier, 0.9);
  assert.strictEqual(profile.skillBudget, 6);
  console.log('PASS: GreyWolf hiddenProfile resolves correctly');
}

// Test 4: MoonWolf 的 hiddenProfile 有品系加成 + Legendary 加成
{
  const profile = resolveBeastBladeProfile({
    species: 'Wolf', lineage: 'MoonWolf', rarity: 'Legendary',
  });
  assert.ok(profile, 'profile should not be null');
  assert.strictEqual(profile.hpMultiplier, 0.95);
  assert.strictEqual(profile.damageMultiplier, Math.round((1.3 + 0.05) * 1.15 * 100) / 100);
  assert.strictEqual(profile.speedMultiplier, 1.5);
  assert.strictEqual(profile.cooldownMultiplier, 0.8);
  assert.strictEqual(profile.skillBudget, 8);
  console.log('PASS: MoonWolf hiddenProfile resolves with lineage+Legendary adjustments');
}

// Test 5: BrownBear 的 hiddenProfile
{
  const profile = resolveBeastBladeProfile({
    species: 'Bear', lineage: 'BrownBear', rarity: 'Common',
  });
  assert.strictEqual(profile.hpMultiplier, 1.8);
  assert.strictEqual(profile.damageMultiplier, 1.4);
  assert.strictEqual(profile.speedMultiplier, 0.6);
  assert.strictEqual(profile.cooldownMultiplier, 1.8);
  assert.strictEqual(profile.skillBudget, 3);
  console.log('PASS: BrownBear hiddenProfile resolves correctly');
}

// Test 6: BengalTiger Rare 的 damageMultiplier 有稀有度加成
{
  const base = getSpeciesLineageProfile('Tiger', 'BengalTiger');
  const profile = resolveBeastBladeProfile({
    species: 'Tiger', lineage: 'BengalTiger', rarity: 'Rare',
  });
  assert.ok(profile.damageMultiplier > base.damageMultiplier, 'Rare should have higher damage than base');
  console.log('PASS: BengalTiger Rare damageMultiplier > base due to rarity');
}

// Test 7: Beast Blade 物品定义存在
{
  const greyWolf = getItemDefinition('GreyWolfBlade');
  assert.ok(greyWolf, 'GreyWolfBlade should exist');
  assert.strictEqual(greyWolf.species, 'Wolf');
  assert.strictEqual(greyWolf.lineage, 'GreyWolf');
  assert.strictEqual(greyWolf.rarity, 'Common');
  assert.strictEqual(greyWolf.individualTrait, 'Fierce');
  assert.strictEqual(greyWolf.width, 2);
  assert.strictEqual(greyWolf.height, 3);
  assert.ok(greyWolf.lifeSkills, 'should have lifeSkills');
  assert.strictEqual(greyWolf.lifeSkills.length, 2);

  const moonWolf = getItemDefinition('MoonWolfBlade');
  assert.strictEqual(moonWolf.rarity, 'Legendary');
  assert.strictEqual(moonWolf.individualTrait, 'Proud');
  assert.strictEqual(moonWolf.width, 3);
  assert.strictEqual(moonWolf.height, 2);

  const brownBear = getItemDefinition('BrownBearBlade');
  assert.strictEqual(brownBear.species, 'Bear');
  assert.strictEqual(brownBear.lineage, 'BrownBear');
  assert.strictEqual(brownBear.individualTrait, 'Loyal');

  const bengalTiger = getItemDefinition('BengalTigerBlade');
  assert.strictEqual(bengalTiger.species, 'Tiger');
  assert.strictEqual(bengalTiger.lineage, 'BengalTiger');
  assert.strictEqual(bengalTiger.rarity, 'Rare');
  assert.strictEqual(bengalTiger.individualTrait, 'Fierce');

  console.log('PASS: All 4 Beast Blade item definitions exist with correct fields');
}

// Test 8: CrimsonBlade 不变
{
  const crimson = getItemDefinition('CrimsonBlade');
  assert.strictEqual(crimson.type, 'Blade');
  assert.strictEqual(crimson.species, undefined);
  console.log('PASS: CrimsonBlade unchanged (no species field)');
}

// Test 9: Element 来自 ElementCore, 不来自 species
{
  const grid = makeGridWith([
    { instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 },
  ]);
  // No core
  const resultNoCore = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(resultNoCore.activeBlades[0].element, 'Neutral');
  assert.strictEqual(resultNoCore.activeBlades[0].species, 'Wolf');

  // With FireCore
  const resultFire = resolveLoadout({
    backpackGrid: grid,
    socketAssignments: { 'wolf_001:socket_1': 'FireCore' },
  });
  assert.strictEqual(resultFire.activeBlades[0].element, 'Fire');
  assert.strictEqual(resultFire.activeBlades[0].damageBonus, 0.1);
  console.log('PASS: Element still from ElementCore (Neutral without, Fire with FireCore)');
}

// Test 10: BladeSpeciesResolved 事件
{
  const grid = makeGridWith([
    { instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  const speciesEvent = (result.events ?? []).find((e) => e.type === CombatEventType.BladeSpeciesResolved);
  assert.ok(speciesEvent, 'should emit BladeSpeciesResolved');
  assert.strictEqual(speciesEvent.data.species, 'Wolf');
  assert.strictEqual(speciesEvent.data.lineage, 'GreyWolf');
  console.log('PASS: BladeSpeciesResolved event emitted for Beast Blade');
}

// Test 11: resolvedBlade 包含 species/lineage/rarity/trait
{
  const grid = makeGridWith([
    { instanceId: 'moon_001', itemId: 'MoonWolfBlade', type: 'Blade', x: 0, y: 0, width: 3, height: 2 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  const b = result.activeBlades[0];
  assert.strictEqual(b.species, 'Wolf');
  assert.strictEqual(b.lineage, 'MoonWolf');
  assert.strictEqual(b.rarity, 'Legendary');
  assert.strictEqual(b.individualTrait, 'Proud');
  assert.ok(b.hiddenProfile, 'should have hiddenProfile');
  assert.ok(b.lifeSkills, 'should have lifeSkills');
  console.log('PASS: resolvedBlade includes species/lineage/rarity/trait/hiddenProfile/lifeSkills');
}

// Test 12: lifeSkills merge — 同名取最高等级
{
  const skills1 = [{ tag: 'Tracking', level: 2 }, { tag: 'Hunting', level: 1 }];
  const skills2 = [{ tag: 'Tracking', level: 3 }, { tag: 'NightVision', level: 3 }];
  const merged = mergeLifeSkills([skills1, skills2]);
  const tracking = merged.find((e) => e.tag === 'Tracking');
  const hunting = merged.find((e) => e.tag === 'Hunting');
  const night = merged.find((e) => e.tag === 'NightVision');
  assert.strictEqual(tracking.level, 3, 'Tracking should be max level 3');
  assert.strictEqual(hunting.level, 1, 'Hunting should stay 1');
  assert.strictEqual(night.level, 3, 'NightVision should be 3');
  console.log('PASS: mergeLifeSkills takes highest level for same-tag skills');
}

// Test 13: activeLifeSkills 在 resolvedLoadout 中
{
  const grid = makeGridWith([
    { instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.ok(Array.isArray(result.activeLifeSkills), 'activeLifeSkills should be array');
  assert.strictEqual(result.activeLifeSkills.length, 2, 'GreyWolf has 2 life skills');
  assert.strictEqual(getLifeSkillLevel(result.activeLifeSkills, 'Tracking'), 2);
  assert.strictEqual(getLifeSkillLevel(result.activeLifeSkills, 'Hunting'), 1);
  console.log('PASS: activeLifeSkills present in resolvedLoadout');
}

// Test 14: 两个 Blade 的 lifeSkills 合并到 activeLifeSkills
{
  const grid = makeGridWith([
    { instanceId: 'wolf_001', itemId: 'GreyWolfBlade', type: 'Blade', x: 0, y: 0, width: 2, height: 3 },
    { instanceId: 'moon_001', itemId: 'MoonWolfBlade', type: 'Blade', x: 0, y: 3, width: 3, height: 2 },
  ]);
  const result = resolveLoadout({ backpackGrid: grid, socketAssignments: {} });
  assert.strictEqual(result.activeBlades.length, 2);
  // Both have Tracking: GreyWolf Lv2 + MoonWolf Lv3 => Lv3
  assert.strictEqual(getLifeSkillLevel(result.activeLifeSkills, 'Tracking'), 3);
  assert.strictEqual(getLifeSkillLevel(result.activeLifeSkills, 'NightVision'), 3);
  assert.strictEqual(getLifeSkillLevel(result.activeLifeSkills, 'TreasureSense'), 2);
  console.log('PASS: activeLifeSkills merges across multiple blades');
}

// Test 15: mergeLifeSkills 空数组返回空
{
  const merged = mergeLifeSkills([]);
  assert.strictEqual(merged.length, 0);
  console.log('PASS: mergeLifeSkills returns empty array for empty input');
}

// Test 16: mergeLifeSkills null 返回空
{
  const merged = mergeLifeSkills(null);
  assert.strictEqual(merged.length, 0);
  console.log('PASS: mergeLifeSkills returns empty array for null input');
}

// Test 17: getLifeSkillLevel 未找到返回 0
{
  const skills = [{ tag: 'Tracking', level: 2 }];
  assert.strictEqual(getLifeSkillLevel(skills, 'Fishing'), 0);
  console.log('PASS: getLifeSkillLevel returns 0 for missing tag');
}
