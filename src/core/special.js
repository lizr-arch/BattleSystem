export class Special {
  constructor({ id, actionSpec, level = 1, effect = null } = {}) {
    if (!id) throw new Error('Special requires id.');
    if (!actionSpec) throw new Error(`Special ${id} requires actionSpec.`);

    this.id = id;
    this.actionSpec = actionSpec;
    this.level = Math.max(1, Math.min(3, level | 0));
    this.effect = effect;
  }
}
