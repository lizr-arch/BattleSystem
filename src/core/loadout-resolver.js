import { createBackpackGrid } from './backpack-grid.js';
import { getItemDefinition } from './backpack-items.js';
import { CombatEventType } from './enums.js';
import { resolveBeastBladeProfile } from './beast-blade.js';
import { mergeLifeSkills } from './life-skills.js';

export function resolveLoadout({
  backpackGrid,
  itemDefinitions,
  socketAssignments = {},
} = {}) {
  const errors = [];

  if (!backpackGrid) {
    errors.push('no backpack grid provided');
    return { activeBlades: [], activeLifeSkills: [], errors, events: [] };
  }

  const defs = itemDefinitions ?? null;

  function getDef(id) {
    if (defs && defs[id]) return defs[id];
    return getItemDefinition(id);
  }

  const validationGrid = createBackpackGrid({ width: backpackGrid.width, height: backpackGrid.height });

  const placedItems = [...(backpackGrid.items ?? [])];
  for (const item of placedItems) {
    const result = validationGrid.place(item);
    if (!result.ok) {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return {
      activeBlades: [],
      errors,
      event: {
        type: CombatEventType.BackpackInvalid,
        data: { errorCount: errors.length },
      },
    };
  }

  const bladeItems = validationGrid.getBladeItems();
  const activeBlades = [];
  const events = [];
  const maxActive = 2;

  for (const placed of bladeItems) {
    if (activeBlades.length >= maxActive) break;

    const definition = getDef(placed.itemId);
    if (!definition || definition.type !== 'Blade') {
      errors.push(`item ${placed.instanceId}: unknown or non-blade item ${placed.itemId}`);
      continue;
    }

    const resolved = {
      bladeInstanceId: placed.instanceId,
      bladeId: definition.id,
      role: definition.role,
      element: 'Neutral',
      damageBonus: 0,
      species: definition.species ?? null,
      lineage: definition.lineage ?? null,
      rarity: definition.rarity ?? null,
      individualTrait: definition.individualTrait ?? null,
      hiddenProfile: null,
      lifeSkills: definition.lifeSkills ? [...definition.lifeSkills] : [],
      footprint: {
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
      },
      sockets: [],
    };

    const internalEq = definition.internalEquipment;
    if (internalEq && internalEq.slotModule) {
      const slotModuleDef = getDef(internalEq.slotModule);
      if (slotModuleDef && slotModuleDef.type === 'BladeSlotModule') {
        for (const sock of (slotModuleDef.generatedSockets ?? [])) {
          if (sock.x < 0 || sock.y < 0 ||
              sock.x + sock.width > definition.width ||
              sock.y + sock.height > definition.height) {
            errors.push(`blade ${placed.instanceId}: socket ${sock.socketId} out of blade footprint`);
            continue;
          }

          const socketInfo = {
            socketId: sock.socketId,
            localX: sock.x,
            localY: sock.y,
            globalX: placed.x + sock.x,
            globalY: placed.y + sock.y,
            width: sock.width,
            height: sock.height,
            accepts: [...(sock.accepts ?? [])],
            itemId: null,
            itemType: null,
          };

          const assignment = socketAssignments[`${placed.instanceId}:${sock.socketId}`];
          if (assignment) {
            const coreDef = getDef(assignment);
            if (coreDef && coreDef.type === 'ElementCore' && sock.accepts.includes('ElementCore')) {
              socketInfo.itemId = coreDef.id;
              socketInfo.itemType = coreDef.type;
              resolved.element = coreDef.element ?? 'Neutral';
              resolved.damageBonus = coreDef.damageBonus ?? 0;
            }
          }

          resolved.sockets.push(socketInfo);
        }
      }
    }

    if (definition.species && definition.lineage && definition.rarity) {
      resolved.hiddenProfile = resolveBeastBladeProfile({
        species: definition.species,
        lineage: definition.lineage,
        rarity: definition.rarity,
      });
      events.push({
        type: CombatEventType.BladeSpeciesResolved,
        data: {
          bladeId: definition.id,
          species: definition.species,
          lineage: definition.lineage,
          rarity: definition.rarity,
          individualTrait: definition.individualTrait ?? '?',
        },
      });
    }

    activeBlades.push(resolved);
  }

  const activeLifeSkills = mergeLifeSkills(activeBlades.map((b) => b.lifeSkills));

  if (errors.length > 0) {
    return {
      activeBlades: [],
      activeLifeSkills: [],
      errors,
      events,
      event: {
        type: CombatEventType.BackpackInvalid,
        data: { errorCount: errors.length },
      },
    };
  }

  return {
    activeBlades,
    activeLifeSkills,
    errors,
    events,
    event: {
      type: CombatEventType.BackpackResolved,
      data: { activeBladeCount: activeBlades.length },
    },
  };
}
