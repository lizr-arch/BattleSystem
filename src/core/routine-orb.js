function cloneTiles(tiles) {
  return (tiles ?? []).map((t) => ({ ...t }));
}

export function addRoutineTile(routineTiles, tile, { maxTiles = 3 } = {}) {
  const tiles = cloneTiles(routineTiles);
  const removed = [];

  tiles.push({ ...tile });
  while (tiles.length > (maxTiles | 0)) {
    removed.push(tiles.shift());
  }

  return { tiles, removed };
}

export function canCreateRoutineOrbFromTiles(routineTiles) {
  const tiles = routineTiles ?? [];
  if (tiles.length !== 3) return false;
  const routineId = tiles[0]?.routineId ?? null;
  if (!routineId) return false;
  return tiles.every((t) => t?.routineId === routineId);
}

export function createRoutineOrbFromTiles(routineTiles, { createdFrame = 0 } = {}) {
  const tiles = routineTiles ?? [];
  const routineId = tiles[0]?.routineId ?? null;
  const totalLayer = tiles.reduce((sum, t) => sum + (Number(t?.layer) | 0), 0);
  return {
    routineId,
    totalLayer,
    createdFrame: Number(createdFrame) | 0,
  };
}

