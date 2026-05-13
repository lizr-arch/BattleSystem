import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { CombatEventType } from '../src/core/enums.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';

const scenarioNames = [
  'beast-blade-wolf-profile',
  'beast-blade-bear-profile',
  'beast-blade-tiger-profile',
  'beast-blade-element-still-from-core',
  'beast-blade-life-skills-resolve',
  'beast-blade-fierce-increases-damage',
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

for (const name of scenarioNames) {
  const { result } = run(name);
  assert.equal(result.passed, true, `Scenario should pass: ${name}`);
  console.log('PASS scenario run: ' + name);
}

{
  const { result } = run('beast-blade-life-skills-resolve');
  const activeLifeSkills = result.finalSnapshot?.resolvedLoadout?.activeLifeSkills ?? [];
  const tracking = activeLifeSkills.find((entry) => entry?.tag === 'Tracking');
  assert.ok(tracking, 'Tracking should be present in activeLifeSkills');
  assert.equal(tracking.level, 3, 'Tracking should merge to Lv3');
}

{
  const { actor } = run('beast-blade-fierce-increases-damage');
  const events = actor.eventLog?.events ?? [];
  const traitEvent = events.find((event) => String(event.type) === String(CombatEventType.BladeTraitActivated));
  assert.ok(traitEvent, 'BladeTraitActivated should be emitted for Fierce');
  assert.equal(traitEvent.data?.trait, 'Fierce');
  assert.equal(traitEvent.data?.effect, 'damage_multiplier');
}

console.log('beast blade scenario tests passed');
