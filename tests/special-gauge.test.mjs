import assert from 'node:assert/strict';

import { SpecialGaugeState } from '../src/core/special-gauge.js';

{
  const g = new SpecialGaugeState();
  assert.equal(g.charge, 0);
  assert.equal(g.readyLevel, 0);
  assert.equal(g.ratio, 0);
}

{
  const g = new SpecialGaugeState({ charge: 90 });
  assert.equal(g.readyLevel, 0);

  const r1 = g.addCharge(15);
  assert.deepEqual(r1, {
    beforeCharge: 90,
    afterCharge: 105,
    beforeReadyLevel: 0,
    afterReadyLevel: 1,
    becameReady: true
  });
  assert.equal(g.readyLevel, 1);

  const r2 = g.addCharge(90);
  assert.deepEqual(r2, {
    beforeCharge: 105,
    afterCharge: 195,
    beforeReadyLevel: 1,
    afterReadyLevel: 1,
    becameReady: false
  });
  assert.equal(g.readyLevel, 1);

  const r3 = g.addCharge(10);
  assert.deepEqual(r3, {
    beforeCharge: 195,
    afterCharge: 205,
    beforeReadyLevel: 1,
    afterReadyLevel: 2,
    becameReady: true
  });
  assert.equal(g.readyLevel, 2);

  const r4 = g.addCharge(999);
  assert.deepEqual(r4, {
    beforeCharge: 205,
    afterCharge: 300,
    beforeReadyLevel: 2,
    afterReadyLevel: 3,
    becameReady: true
  });
  assert.equal(g.charge, 300);
  assert.equal(g.readyLevel, 3);

  const r5 = g.addCharge(999);
  assert.deepEqual(r5, {
    beforeCharge: 300,
    afterCharge: 300,
    beforeReadyLevel: 3,
    afterReadyLevel: 3,
    becameReady: false
  });
}

{
  const g = new SpecialGaugeState({ charge: 250 });
  assert.equal(g.readyLevel, 2);

  const fail3 = g.tryConsumeLevel(3);
  assert.deepEqual(fail3, {
    ok: false,
    level: 3,
    cost: 300,
    beforeCharge: 250,
    afterCharge: 250,
    beforeReadyLevel: 2,
    afterReadyLevel: 2
  });
  assert.equal(g.charge, 250);

  const ok2 = g.tryConsumeLevel(2);
  assert.deepEqual(ok2, {
    ok: true,
    level: 2,
    cost: 200,
    beforeCharge: 250,
    afterCharge: 50,
    beforeReadyLevel: 2,
    afterReadyLevel: 0
  });
  assert.equal(g.charge, 50);
  assert.equal(g.readyLevel, 0);

  const fail1 = g.tryConsumeLevel(1);
  assert.deepEqual(fail1, {
    ok: false,
    level: 1,
    cost: 100,
    beforeCharge: 50,
    afterCharge: 50,
    beforeReadyLevel: 0,
    afterReadyLevel: 0
  });
}

console.log('special gauge test passed');
