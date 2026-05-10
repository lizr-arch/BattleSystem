export class Art {
  constructor({ id, actionSpec, maxCharge, effect = null, specialChargeGain = 0 }) {
    if (!id) throw new Error('Art requires id.');
    if (!actionSpec) throw new Error(`Art ${id} requires actionSpec.`);

    this.id = id;
    this.actionSpec = actionSpec;
    this.maxCharge = Math.max(1, maxCharge | 0);
    this.charge = 0;
    this.effect = effect;
    this.specialChargeGain = Math.max(0, specialChargeGain | 0);
  }

  get ready() {
    return this.charge >= this.maxCharge;
  }

  addCharge(amount) {
    const before = this.charge;
    this.charge = Math.min(this.maxCharge, this.charge + Math.max(0, amount | 0));

    return {
      before,
      after: this.charge,
      becameReady: before < this.maxCharge && this.charge >= this.maxCharge
    };
  }

  consume() {
    if (!this.ready) {
      throw new Error(`Art ${this.id} is not ready.`);
    }

    this.charge = 0;
  }

  setMaxCharge(maxCharge) {
    this.maxCharge = Math.max(1, maxCharge | 0);
    this.charge = Math.min(this.charge, this.maxCharge);
  }
}
