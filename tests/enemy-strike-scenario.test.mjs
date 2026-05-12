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

{
  const { result } = run('enemy-strike-defeat');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.battle?.result, 'Defeat');
  assert.equal(result.finalSnapshot.player?.dead, true);
}

{
  const { result } = run('enemy-strike-suppressed-by-driver-combo');
  assert.equal(result.passed, true);
  assert.equal(result.finalSnapshot.enemy?.currentAction, null);
}

console.log('enemy strike scenario tests passed');
