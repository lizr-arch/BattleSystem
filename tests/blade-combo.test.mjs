import assert from 'node:assert/strict';

import { BladeComboState } from '../src/core/blade-combo.js';
import { BladeComboElement, BladeComboStage, CombatEventType } from '../src/core/enums.js';

function createState() {
  return new BladeComboState({
    routes: [
      {
        id: 'FireWaterFire',
        durationFrames: 240,
        tokenId: 'FireToken',
        steps: [
          { element: BladeComboElement.Fire, minLevel: 1 },
          { element: BladeComboElement.Water, minLevel: 2 },
          { element: BladeComboElement.Fire, minLevel: 3 },
        ],
      },
    ],
  });
}

{
  const bc = createState();
  const r1 = bc.apply({ element: BladeComboElement.Fire, level: 1 });
  assert.equal(r1.events[0].type, CombatEventType.BladeComboStarted);
  assert.equal(bc.stage, BladeComboStage.Stage1);
  assert.equal(bc.framesLeft, 240);
  assert.equal(r1.events[0].data.expectedNextElement, BladeComboElement.Water);
  assert.equal(r1.token, null);
}

{
  const bc = createState();
  bc.apply({ element: BladeComboElement.Fire, level: 1 });
  const r2 = bc.apply({ element: BladeComboElement.Water, level: 2 });
  assert.equal(r2.events[0].type, CombatEventType.BladeComboAdvanced);
  assert.equal(r2.events[0].data.fromStage, BladeComboStage.Stage1);
  assert.equal(r2.events[0].data.toStage, BladeComboStage.Stage2);
  assert.equal(bc.stage, BladeComboStage.Stage2);
  assert.equal(bc.framesLeft, 240);
}

{
  const bc = createState();
  bc.apply({ element: BladeComboElement.Fire, level: 1 });
  const failed = bc.apply({ element: BladeComboElement.Fire, level: 1 });
  assert.equal(failed.events[0].type, CombatEventType.BladeComboFailed);
  assert.equal(failed.events[0].data.reason, 'wrong_element');
  assert.equal(failed.events[0].data.requiresElement, BladeComboElement.Water);
  assert.equal(bc.stage, BladeComboStage.Stage1);
}

{
  const bc = createState();
  bc.apply({ element: BladeComboElement.Fire, level: 1 });
  const failed = bc.apply({ element: BladeComboElement.Water, level: 1 });
  assert.equal(failed.events[0].type, CombatEventType.BladeComboFailed);
  assert.equal(failed.events[0].data.reason, 'insufficient_level');
  assert.equal(failed.events[0].data.requiresMinLevel, 2);
  assert.equal(bc.stage, BladeComboStage.Stage1);
}

{
  const bc = createState();
  bc.apply({ element: BladeComboElement.Fire, level: 1 });
  bc.framesLeft = 1;
  const expired = bc.tick(1);
  assert.ok(expired);
  assert.equal(expired.type, CombatEventType.BladeComboExpired);
  assert.equal(expired.data.stage, BladeComboStage.Stage1);
  assert.equal(bc.stage, BladeComboStage.None);
}

{
  const bc = createState();
  bc.apply({ element: BladeComboElement.Fire, level: 1 });
  bc.apply({ element: BladeComboElement.Water, level: 2 });
  const finished = bc.apply({ element: BladeComboElement.Fire, level: 3 });
  assert.equal(finished.events[0].type, CombatEventType.BladeComboFinished);
  assert.equal(finished.token.id, 'FireToken');
  assert.equal(finished.token.element, BladeComboElement.Fire);
  assert.equal(finished.token.sourceRouteId, 'FireWaterFire');
  assert.equal(bc.stage, BladeComboStage.None);
  assert.equal(bc.framesLeft, 0);
}

console.log('blade combo test passed');
