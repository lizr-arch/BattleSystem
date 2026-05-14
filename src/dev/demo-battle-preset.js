import { CombatEventType } from '../core/enums.js';
import { EnemyStrikeSpec } from '../core/enemy-strike.js';
import { createBackpackGrid } from '../core/backpack-grid.js';
import { resolveLoadout } from '../core/loadout-resolver.js';
import { createBondState } from '../core/bond.js';
import { resolveCombatUnlocks } from '../core/combat-unlocks.js';

const TRAINING_BRUTE_SPEC = Object.freeze({
  id: 'TrainingBrute',
  hp: 650,
  maxHp: 650,
  x: 660,
  y: 400,
  radius: 38,
  strike: Object.freeze({
    id: 'TrainingBruteStrike',
    startupFrames: 32,
    activeFrames: 4,
    recoveryFrames: 28,
    cooldownFrames: 75,
    damage: 18,
    range: 170,
  }),
});

const DEMO_PLAYER_SPEC = Object.freeze({
  hp: 240,
  maxHp: 240,
  x: 310,
  y: 400,
});

function createDemoBackpack() {
  const grid = createBackpackGrid({ width: 9, height: 9 });

  grid.place({
    itemId: 'GreyWolfBlade',
    type: 'Blade',
    x: 0,
    y: 0,
    width: 2,
    height: 3,
    instanceId: 'demo_greywolf',
  });

  grid.place({
    itemId: 'BrownBearBlade',
    type: 'Blade',
    x: 3,
    y: 0,
    width: 3,
    height: 3,
    instanceId: 'demo_brownbear',
  });

  return grid;
}

function getDemoSocketAssignments() {
  return {
    'demo_greywolf:socket_1': 'FireCore',
  };
}

function applyDemoBond(activeBlades) {
  for (const blade of activeBlades) {
    blade.bond = createBondState({ trust: 250, trustLevel: 3, mood: 50, sync: 0 });
    blade.unlocks = resolveCombatUnlocks({ bond: blade.bond });
  }
}

export function createDemoBattlePreset({ createActor } = {}) {
  if (typeof createActor !== 'function') {
    throw new Error('createDemoBattlePreset requires createActor factory function');
  }

  const br = TRAINING_BRUTE_SPEC;
  const target = {
    id: br.id,
    x: br.x,
    y: br.y,
    radius: br.radius,
    hp: br.hp,
    maxHp: br.maxHp,
  };

  const enemyStrike = new EnemyStrikeSpec({
    id: br.strike.id,
    startupFrames: br.strike.startupFrames,
    activeFrames: br.strike.activeFrames,
    recoveryFrames: br.strike.recoveryFrames,
    cooldownFrames: br.strike.cooldownFrames,
    damage: br.strike.damage,
    range: br.strike.range,
  });

  const backpackGrid = createDemoBackpack();
  const socketAssignments = getDemoSocketAssignments();

  const resolved = resolveLoadout({ backpackGrid, socketAssignments });
  applyDemoBond(resolved.activeBlades);

  const actor = createActor({
    target,
    enemyStrike,
    playerHp: DEMO_PLAYER_SPEC.hp,
    playerMaxHp: DEMO_PLAYER_SPEC.maxHp,
    position: { x: DEMO_PLAYER_SPEC.x, y: DEMO_PLAYER_SPEC.y },
    resolvedLoadout: resolved,
    backpackGrid: null,
  });

  return actor;
}

export function resetDemoPreset(actor) {
  if (!actor) return;

  actor.commitBladeBondStates({ resetBattleTransient: true });
  actor.bladeRuntimes = [];
  actor.refreshBladeUnlocks();

  if (actor.resolvedLoadout?.activeBlades?.length) {
    for (const blade of actor.resolvedLoadout.activeBlades) {
      actor.linkBlade(blade);
    }
  }

  actor.x = DEMO_PLAYER_SPEC.x;
  actor.y = DEMO_PLAYER_SPEC.y;

  if (actor.player) {
    actor.player.hp = DEMO_PLAYER_SPEC.hp;
    actor.player.maxHp = DEMO_PLAYER_SPEC.maxHp;
    actor.player.dead = false;
  }

  if (actor.target) {
    actor.target.hp = TRAINING_BRUTE_SPEC.hp;
    actor.target.maxHp = TRAINING_BRUTE_SPEC.maxHp;
    actor.target.dead = false;
  }

  if (actor.battle) {
    actor.battle.active = true;
    actor.battle.result = null;
  }

  if (actor.enemy) {
    actor.enemy.cooldownLeft = 0;
    actor.enemy.action = null;
  }

  actor.eventLog.clear();
  actor.emit(CombatEventType.Reset);
  actor.emit(CombatEventType.BattleStarted, {
    targetId: actor.target?.id ?? 'TrainingBrute',
    targetHp: actor.target?.hp ?? 0,
    targetMaxHp: actor.target?.maxHp ?? 0,
  });

  return actor;
}

export { TRAINING_BRUTE_SPEC, DEMO_PLAYER_SPEC };
