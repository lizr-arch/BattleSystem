export function createBackpackGrid({ width = 9, height = 9, items = [] } = {}) {
  const _errors = [];

  function cellsOverlap(a, b) {
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    const bRight = b.x + b.width;
    const bBottom = b.y + b.height;
    return a.x < bRight && b.x < aRight && a.y < bBottom && b.y < aBottom;
  }

  function canPlace(item) {
    if (item.x < 0 || item.y < 0) {
      return { ok: false, error: `item ${item.instanceId ?? '?'} out of bounds: x=${item.x} y=${item.y}` };
    }
    if (item.x + item.width > width || item.y + item.height > height) {
      return { ok: false, error: `item ${item.instanceId ?? '?'} out of bounds: x+width=${item.x + item.width} y+height=${item.y + item.height} (grid ${width}x${height})` };
    }
    for (const existing of items) {
      if (cellsOverlap(item, existing)) {
        return { ok: false, error: `item ${item.instanceId ?? '?'} overlaps ${existing.instanceId}` };
      }
    }
    return { ok: true };
  }

  function place(item) {
    const result = canPlace(item);
    if (!result.ok) {
      _errors.push(result.error);
      return result;
    }
    const placed = { ...item };
    if (!placed.instanceId) {
      placed.instanceId = `item_${items.length}`;
    }
    items.push(placed);
    return { ok: true };
  }

  function getBladeItems() {
    return items.filter((it) => it.type === 'Blade');
  }

  function getPlacementErrors() {
    return [..._errors];
  }

  function getSnapshot() {
    return {
      width,
      height,
      items: items.map((it) => ({ ...it })),
    };
  }

  function findItemById(instanceId) {
    return items.find((it) => it.instanceId === instanceId) ?? null;
  }

  return {
    get width() { return width; },
    get height() { return height; },
    get items() { return items; },
    canPlace,
    place,
    getBladeItems,
    getPlacementErrors,
    getSnapshot,
    findItemById,
  };
}
