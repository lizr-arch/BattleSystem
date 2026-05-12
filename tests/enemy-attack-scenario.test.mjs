import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

function run(name) {
  const actor = createDefaultCombatActor();
  const scenario = getScenario(name);
  const result = runScenario({
    actor,
    name: scenario.name,
    maxFrames: scenario.maxFrames,
    steps: scenario.steps,
    prepare: scenario.prepare,
    logToConsole: false,
  });
  return { actor, result };
}

const required = [
  'enemy-starts-attack-when-player-in-range',
  'enemy-attack-hits-player',
  'enemy-attack-whiffs-when-player-out-of-range',
  'enemy-attack-enters-cooldown',
  'enemy-cannot-attack-while-toppled',
  'enemy-can-defeat-player',
  'player-can-defeat-attacking-enemy',
];

for (const name of required) {
  const { result } = run(name);
  assert.equal(result.passed, true, `Scenario should pass: ${name}`);
}

{
  const { result } = run('enemy-can-defeat-player');
  assert.equal(result.finalSnapshot.battle?.result, 'Defeat');
  assert.equal(result.finalSnapshot.player?.dead, true);
}

{
  const { result } = run('player-can-defeat-attacking-enemy');
  assert.equal(result.finalSnapshot.target?.dead, true);
}

console.log('enemy attack scenario tests passed');

