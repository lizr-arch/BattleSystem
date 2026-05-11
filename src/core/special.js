export class Special {
  constructor({ id, actionSpec, level = 1, element = null, damage = undefined, effect = null } = {}) {
    if (!id) throw new Error('Special requires id.');
    if (!actionSpec) throw new Error(`Special ${id} requires actionSpec.`);

    this.id = id;
    this.actionSpec = actionSpec;
    this.level = Math.max(1, Math.min(3, level | 0));
    this.element = element;
    const rawDamage = damage === undefined || damage === null ? Number(actionSpec.damage ?? 0) : Number(damage);
    this.damage = Number.isFinite(rawDamage) ? rawDamage : 0;
    this.actionSpec.damage = this.damage;
    this.effect = effect;
  }
}
