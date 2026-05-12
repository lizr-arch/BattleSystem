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
