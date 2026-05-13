import assert from 'node:assert/strict';

import { scenarios, getScenario } from '../src/dev/scenarios.js';

const scenarioNames = [
  'beast-blade-wolf-profile',
  'beast-blade-bear-profile',
  'beast-blade-tiger-profile',
  'beast-blade-element-still-from-core',
  'beast-blade-life-skills-resolve',
  'beast-blade-fierce-increases-damage',
];

for (const name of scenarioNames) {
  const scenario = getScenario(name);
  assert.ok(scenario, `Scenario ${name} should exist`);
  assert.strictEqual(scenario.name, name, `Scenario ${name} name should match`);
  assert.ok(Array.isArray(scenario.steps), `${name} should have steps`);
  assert.ok(scenario.steps.length > 0, `${name} should have at least one step`);
  console.log('PASS scenario: ' + name);
}
