export const DebuffType = Object.freeze({
  Burn: 'Burn',
});

export function createBurnDebuff({ appliedFrame = 0 } = {}) {
  return {
    type: DebuffType.Burn,
    framesLeft: 300,
    tickEveryFrames: 60,
    tickLeft: 60,
    tickDamage: 5,
    appliedFrame: Number(appliedFrame) | 0,
  };
}

export function tickDebuffs(debuffs, frames = 1) {
  const next = [];
  const ticks = [];
  const expired = [];

  for (const d0 of debuffs ?? []) {
    const d = { ...d0 };
    let f = frames | 0;

    while (f > 0 && d.framesLeft > 0) {
      d.framesLeft -= 1;
      d.tickLeft -= 1;
      if (d.tickLeft <= 0 && d.framesLeft > 0) {
        ticks.push({ type: d.type, damage: Number(d.tickDamage) | 0 });
        d.tickLeft = Number(d.tickEveryFrames) | 0;
      }
      f -= 1;
    }

    if (d.framesLeft <= 0) {
      expired.push({ type: d.type });
    } else {
      next.push(d);
    }
  }

  return { debuffs: next, ticks, expired };
}

