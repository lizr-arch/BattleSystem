import assert from 'node:assert/strict';

const Phase = {
  Startup: 'Startup',
  Active: 'Active',
  Recovery: 'Recovery',
  Finished: 'Finished',
};

class ActionSpec {
  constructor({ startup, active, recovery }) {
    this.startup = startup;
    this.active = active;
    this.recovery = recovery;
    this.total = startup + active + recovery;
  }

  phaseAt(frame) {
    if (frame < this.startup) return Phase.Startup;
    if (frame < this.startup + this.active) return Phase.Active;
    if (frame < this.total) return Phase.Recovery;
    return Phase.Finished;
  }
}

const aa1 = new ActionSpec({ startup: 18, active: 2, recovery: 24 });

assert.equal(aa1.phaseAt(0), Phase.Startup);
assert.equal(aa1.phaseAt(17), Phase.Startup);
assert.equal(aa1.phaseAt(18), Phase.Active);
assert.equal(aa1.phaseAt(19), Phase.Active);
assert.equal(aa1.phaseAt(20), Phase.Recovery);
assert.equal(aa1.phaseAt(43), Phase.Recovery);
assert.equal(aa1.phaseAt(44), Phase.Finished);

console.log('combat timing smoke test passed');
