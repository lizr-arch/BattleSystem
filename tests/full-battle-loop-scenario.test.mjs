import assert from 'node:assert/strict';

import { createDefaultCombatActor } from '../src/data/default-combat-config.js';
import { runScenario } from '../src/dev/scenario-runner.js';
import { getScenario } from '../src/dev/scenarios.js';
import { BladeComboStage, DriverComboStage } from '../src/core/enums.js';

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

function proofHasSubstring(proof, substring) {
  const s = String(substring);
  return (proof ?? []).some((p) => String(p?.label ?? '').includes(s));
}

{
  const { result } = run('full-battle-loop');

  assert.equal(result.passed, true);

  assert.ok(proofHasSubstring(result.proof, 'DriverComboFinished'));
  assert.ok(proofHasSubstring(result.proof, 'BladeComboFinished'));
  assert.ok(proofHasSubstring(result.proof, 'TokenCreated FireToken'));

  assert.equal(result.finalSnapshot.driverCombo.stage, DriverComboStage.None);
  assert.equal(result.finalSnapshot.bladeCombo.stage, BladeComboStage.None);
  assert.ok((result.finalSnapshot.tokens ?? []).some((t) => t?.id === 'FireToken'));
}

console.log('full battle loop scenario test passed');
