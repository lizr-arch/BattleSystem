export class SpecialGaugeState {
  constructor({ charge = 0 } = {}) {
    this.threshold1 = 100;
    this.threshold2 = 200;
    this.threshold3 = 300;
    this.charge = Math.max(0, Math.min(this.threshold3, charge | 0));
  }

  get ratio() {
    return this.threshold3 > 0 ? Math.max(0, Math.min(1, this.charge / this.threshold3)) : 0;
  }

  get readyLevel() {
    const c = this.charge;
    if (c >= this.threshold3) return 3;
    if (c >= this.threshold2) return 2;
    if (c >= this.threshold1) return 1;
    return 0;
  }

  reset() {
    this.charge = 0;
  }

  addCharge(amount) {
    const beforeCharge = this.charge;
    const beforeReadyLevel = this.readyLevel;
    const n = Math.max(0, amount | 0);
    this.charge = Math.min(this.threshold3, this.charge + n);
    const afterCharge = this.charge;
    const afterReadyLevel = this.readyLevel;
    return {
      beforeCharge,
      afterCharge,
      beforeReadyLevel,
      afterReadyLevel,
      becameReady: afterReadyLevel > beforeReadyLevel
    };
  }

  tryConsumeLevel(level) {
    const beforeCharge = this.charge;
    const beforeReadyLevel = this.readyLevel;
    const lv = Math.max(0, Math.min(3, level | 0));
    const cost = lv * 100;
    if (lv <= 0) {
      return {
        ok: false,
        level: lv,
        cost,
        beforeCharge,
        afterCharge: beforeCharge,
        beforeReadyLevel,
        afterReadyLevel: beforeReadyLevel
      };
    }

    if (beforeReadyLevel < lv || beforeCharge < cost) {
      return {
        ok: false,
        level: lv,
        cost,
        beforeCharge,
        afterCharge: beforeCharge,
        beforeReadyLevel,
        afterReadyLevel: beforeReadyLevel
      };
    }

    this.charge = beforeCharge - cost;
    const afterCharge = this.charge;
    const afterReadyLevel = this.readyLevel;
    return {
      ok: true,
      level: lv,
      cost,
      beforeCharge,
      afterCharge,
      beforeReadyLevel,
      afterReadyLevel
    };
  }
}
