import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

const scenarioNames = [
  'demo-hud-model-stable',
  'demo-player-facing-hud-ready',
  'demo-dev-diagnostics-no-warnings',
  'demo-tuned-player-can-win',
  'demo-tuned-player-can-lose',
  'demo-r-key-reset-keeps-demo',
];

function run(name) {
  const actor = createDefaultCombatActor();
  const scenario = getScenario(name);
  assert.ok(scenario, `Scenario should exist: ${name}`);
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

let anyFailed = false;

for (const name of scenarioNames) {
  const { actor, result } = run(name);
  try {
    assert.equal(result.passed, true, `${name} should pass`);
    console.log(`PASS scenario: ${name}`);
  } catch (err) {
    anyFailed = true;
    console.log(`FAIL scenario: ${name}: ${err.message}`);
  }
}

if (anyFailed) {
  console.log('demo tuning scenario tests FAILED');
  process.exit(1);
}

console.log('demo tuning scenario tests passed');
