export const ITEM_DEFINITIONS = Object.freeze({
  CrimsonBlade: Object.freeze({
    id: 'CrimsonBlade',
    type: 'Blade',
    role: 'DPS',
    width: 3,
    height: 3,
    autoAttack: Object.freeze({
      startupFrames: 18,
      activeFrames: 2,
      recoveryFrames: 28,
      damage: 24,
      range: 190,
      cooldownFrames: 45,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
  }),

  GuardianBlade: Object.freeze({
    id: 'GuardianBlade',
    type: 'Blade',
    role: 'Tank',
    width: 3,
    height: 3,
    autoAttack: Object.freeze({
      startupFrames: 24,
      activeFrames: 2,
      recoveryFrames: 42,
      damage: 12,
      range: 170,
      cooldownFrames: 60,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
  }),

  GreyWolfBlade: Object.freeze({
    id: 'GreyWolfBlade',
    type: 'Blade',
    role: 'DPS',
    species: 'Wolf',
    lineage: 'GreyWolf',
    rarity: 'Common',
    individualTrait: 'Fierce',
    width: 2,
    height: 3,
    autoAttack: Object.freeze({
      startupFrames: 16,
      activeFrames: 2,
      recoveryFrames: 22,
      damage: 18,
      range: 180,
      cooldownFrames: 36,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
    lifeSkills: Object.freeze([
      Object.freeze({ tag: 'Tracking', level: 2 }),
      Object.freeze({ tag: 'Hunting', level: 1 }),
    ]),
  }),

  MoonWolfBlade: Object.freeze({
    id: 'MoonWolfBlade',
    type: 'Blade',
    role: 'DPS',
    species: 'Wolf',
    lineage: 'MoonWolf',
    rarity: 'Legendary',
    individualTrait: 'Proud',
    width: 3,
    height: 2,
    autoAttack: Object.freeze({
      startupFrames: 14,
      activeFrames: 2,
      recoveryFrames: 20,
      damage: 20,
      range: 190,
      cooldownFrames: 30,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
    lifeSkills: Object.freeze([
      Object.freeze({ tag: 'NightVision', level: 3 }),
      Object.freeze({ tag: 'Tracking', level: 3 }),
      Object.freeze({ tag: 'TreasureSense', level: 2 }),
    ]),
  }),

  BrownBearBlade: Object.freeze({
    id: 'BrownBearBlade',
    type: 'Blade',
    role: 'Tank',
    species: 'Bear',
    lineage: 'BrownBear',
    rarity: 'Common',
    individualTrait: 'Loyal',
    width: 3,
    height: 3,
    autoAttack: Object.freeze({
      startupFrames: 28,
      activeFrames: 3,
      recoveryFrames: 50,
      damage: 30,
      range: 160,
      cooldownFrames: 72,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
    lifeSkills: Object.freeze([
      Object.freeze({ tag: 'Mining', level: 2 }),
      Object.freeze({ tag: 'Carrying', level: 2 }),
      Object.freeze({ tag: 'Guarding', level: 1 }),
    ]),
  }),

  BengalTigerBlade: Object.freeze({
    id: 'BengalTigerBlade',
    type: 'Blade',
    role: 'DPS',
    species: 'Tiger',
    lineage: 'BengalTiger',
    rarity: 'Rare',
    individualTrait: 'Fierce',
    width: 3,
    height: 3,
    autoAttack: Object.freeze({
      startupFrames: 20,
      activeFrames: 2,
      recoveryFrames: 32,
      damage: 26,
      range: 185,
      cooldownFrames: 48,
    }),
    internalEquipment: Object.freeze({
      slotModule: 'SmallSocketModule',
    }),
    lifeSkills: Object.freeze([
      Object.freeze({ tag: 'Hunting', level: 3 }),
      Object.freeze({ tag: 'Scouting', level: 2 }),
      Object.freeze({ tag: 'Guarding', level: 1 }),
    ]),
  }),

  SmallSocketModule: Object.freeze({
    id: 'SmallSocketModule',
    type: 'BladeSlotModule',
    generatedSockets: Object.freeze([
      Object.freeze({
        socketId: 'socket_1',
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        accepts: Object.freeze(['ElementCore']),
      }),
    ]),
  }),

  FireCore: Object.freeze({
    id: 'FireCore',
    type: 'ElementCore',
    element: 'Fire',
    damageBonus: 0.1,
  }),
});

export function getItemDefinition(id) {
  return ITEM_DEFINITIONS[id] ?? null;
}

export function getAllItemDefinitions() {
  return { ...ITEM_DEFINITIONS };
}

export function getBladeDefinitions() {
  return Object.values(ITEM_DEFINITIONS).filter((def) => def.type === 'Blade');
}
