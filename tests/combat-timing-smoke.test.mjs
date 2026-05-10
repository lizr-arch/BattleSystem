import assert from 'node:assert/strict';

import { CombatActionSpec } from '../src/core/action.js';
import { ActionKind, ActionPhase } from '../src/core/enums.js';

const aa1 = new CombatActionSpec({
  id: 'AA1',
  kind: ActionKind.AutoAttack,
  startupFrames: 18,
  activeFrames: 2,
  recoveryFrames: 24,
});

assert.equal(aa1.phaseAt(0), ActionPhase.Startup);
assert.equal(aa1.phaseAt(17), ActionPhase.Startup);
assert.equal(aa1.phaseAt(18), ActionPhase.Active);
assert.equal(aa1.phaseAt(19), ActionPhase.Active);
assert.equal(aa1.phaseAt(20), ActionPhase.Recovery);
assert.equal(aa1.phaseAt(43), ActionPhase.Recovery);
assert.equal(aa1.phaseAt(44), ActionPhase.Finished);

console.log('combat timing smoke test passed');
