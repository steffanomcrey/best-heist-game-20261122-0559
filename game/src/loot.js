// Loot: paintings, gold stacks and the Meridian Diamond. Each item has a value;
// `target` items must all be taken before the exit opens. Pure logic.
export function createLoot(def) {
  return {
    id: def.id,
    kind: def.kind, // painting | gold | diamond | crate
    label: def.label,
    x: def.x,
    y: def.y,
    value: def.value,
    target: !!def.target,
    taken: false,
  };
}

/** Collect every loot item within reach; returns the value just taken. */
export function collectLoot(items, px, py, reach) {
  let gained = 0;
  const names = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.taken) continue;
    if (Math.hypot(item.x - px, item.y - py) < reach) {
      item.taken = true;
      gained += item.value;
      names.push(item.label);
    }
  }
  return { gained, names };
}

export function targetsLeft(items) {
  let n = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].target && !items[i].taken) n += 1;
  }
  return n;
}
