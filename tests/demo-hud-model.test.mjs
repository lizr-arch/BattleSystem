import { createDemoHudModel } from '../src/dev/demo-hud-model.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL: ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function makeDemoSnapshot(overrides = {}) {
  const defaults = {
    resolvedLoadout: {
      activeBlades: [
        { bladeId: 'GreyWolfBlade' },
        { bladeId: 'BrownBearBlade' },
      ],
    },
    player: { hp: 240, maxHp: 240, dead: false },
    target: { id: 'TrainingBrute', hp: 650, maxHp: 650, dead: false },
    enemy: { state: 'Idle' },
    battle: { active: true, result: null },
    state: 'Locomotion',
    action: { phase: 'None' },
    eventLogText: '',
    bladeRuntimes: [
      {
        bladeId: 'demo_greywolf',
        species: 'Wolf',
        lineage: 'GreyWolf',
        element: 'Fire',
        individualTrait: 'Fierce',
        bond: { trustLevel: 3 },
        unlocks: { combatSlots: ['BondCombatSlot1'] },
      },
      {
        bladeId: 'demo_brownbear',
        species: 'Bear',
        lineage: 'BrownBear',
        element: 'Neutral',
        individualTrait: 'Loyal',
        bond: { trustLevel: 3 },
        unlocks: { combatSlots: ['BondCombatSlot1'] },
      },
    ],
    inputBuffer: { hasArt: false, ratio: 0, maxFrames: 10 },
    cancelBonus: { left: 0, frames: 15 },
  };

  return deepMerge(defaults, overrides);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

test('Normal demo snapshot produces valid HUD model structure', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  assert(model.isDemo === true, 'isDemo should be true');
  const keys = ['isDemo', 'player', 'enemy', 'battle', 'controls', 'blades', 'recent', 'diagnostics'];
  for (const key of keys) {
    assert(key in model, `model should contain key: ${key}`);
  }
});

test('enemy.id is TrainingBrute', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  assert(model.enemy.id === 'TrainingBrute', `Expected TrainingBrute, got ${model.enemy.id}`);
});

test('player hpText exists and contains /', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  assert(typeof model.player.hpText === 'string', 'player.hpText should be a string');
  assert(model.player.hpText.includes('/'), `player.hpText should contain /, got ${model.player.hpText}`);
});

test('enemy hpText exists and contains /', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  assert(typeof model.enemy.hpText === 'string', 'enemy.hpText should be a string');
  assert(model.enemy.hpText.includes('/'), `enemy.hpText should contain /, got ${model.enemy.hpText}`);
});

test('controls includes WASD / 1-4 / R', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  const controlTexts = model.controls.join(' ');
  assert(controlTexts.includes('WASD'), 'controls should mention WASD');
  assert(controlTexts.includes('1-4'), 'controls should mention 1-4');
  assert(controlTexts.includes('R'), 'controls should mention R');
});

test('blades includes GreyWolfBlade / BrownBearBlade', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  const hasWolf = model.blades.some((b) => b.bladeId.toLowerCase().includes('greywolf'));
  const hasBear = model.blades.some((b) => b.bladeId.toLowerCase().includes('brownbear'));
  assert(hasWolf, 'blades should include greywolf');
  assert(hasBear, 'blades should include brownbear');
});

test('Normal demo diagnostics.warnings is empty', () => {
  const model = createDemoHudModel(makeDemoSnapshot());
  assert(
    model.diagnostics.warnings.length === 0,
    `warnings should be empty, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on fewer than 2 active blades', () => {
  const snapshot = makeDemoSnapshot({
    resolvedLoadout: {
      activeBlades: [{ bladeId: 'GreyWolfBlade' }],
    },
  });
  const model = createDemoHudModel(snapshot, { isDemo: true });
  assert(
    model.diagnostics.warnings.includes('Demo expected at least 2 active blades.'),
    `Expected warning about active blades, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on non-TrainingBrute target', () => {
  const snapshot = makeDemoSnapshot({
    target: { id: 'OtherEnemy', hp: 650, maxHp: 650, dead: false },
  });
  const model = createDemoHudModel(snapshot);
  assert(
    model.diagnostics.warnings.includes('Demo expected TrainingBrute target.'),
    `Expected warning about TrainingBrute target, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on battle inactive without result', () => {
  const snapshot = makeDemoSnapshot({
    battle: { active: false, result: null },
  });
  const model = createDemoHudModel(snapshot);
  assert(
    model.diagnostics.warnings.includes('Battle inactive without result.'),
    `Expected warning about inactive battle, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on player HP 0 without Defeat', () => {
  const snapshot = makeDemoSnapshot({
    player: { hp: 0, maxHp: 240, dead: true },
    battle: { active: false, result: null },
  });
  const model = createDemoHudModel(snapshot);
  assert(
    model.diagnostics.warnings.includes('Player HP is 0 but battle result is not Defeat.'),
    `Expected warning about player HP 0, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on enemy HP 0 without Victory', () => {
  const snapshot = makeDemoSnapshot({
    target: { id: 'TrainingBrute', hp: 0, maxHp: 650, dead: true },
    battle: { active: false, result: null },
  });
  const model = createDemoHudModel(snapshot);
  assert(
    model.diagnostics.warnings.includes('Enemy HP is 0 but battle result is not Victory.'),
    `Expected warning about enemy HP 0, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

test('Warning on demo blade missing BondCombatSlot1', () => {
  const snapshot = makeDemoSnapshot({
    bladeRuntimes: [
      {
        bladeId: 'demo_greywolf',
        species: 'Wolf',
        lineage: 'GreyWolf',
        element: 'Fire',
        individualTrait: 'Fierce',
        bond: { trustLevel: 3 },
        unlocks: { combatSlots: [] },
      },
      {
        bladeId: 'demo_brownbear',
        species: 'Bear',
        lineage: 'BrownBear',
        element: 'Neutral',
        individualTrait: 'Loyal',
        bond: { trustLevel: 3 },
        unlocks: { combatSlots: [] },
      },
    ],
  });
  const model = createDemoHudModel(snapshot);
  assert(
    model.diagnostics.warnings.includes('Demo blade missing BondCombatSlot1.'),
    `Expected warning about missing BondCombatSlot1, got: ${JSON.stringify(model.diagnostics.warnings)}`
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
