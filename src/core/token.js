function clampInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x | 0;
}

function normalizeString(v) {
  const s = String(v ?? '');
  return s.length ? s : null;
}

export function createToken({ id, element = null, sourceRouteId = null, createdFrame = 0 } = {}) {
  const tokenId = normalizeString(id);
  if (!tokenId) throw new Error('Token requires id.');

  return {
    id: tokenId,
    element: element ?? null,
    sourceRouteId: normalizeString(sourceRouteId),
    createdFrame: Math.max(0, clampInt(createdFrame)),
  };
}
