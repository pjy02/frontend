type SortableNode = Pick<API.Node, "id" | "sort">;

export function sortNodes<T extends SortableNode>(nodes: T[]) {
  return nodes.slice().sort((a, b) => {
    const left = Number.isSafeInteger(a.sort)
      ? a.sort
      : Number.POSITIVE_INFINITY;
    const right = Number.isSafeInteger(b.sort)
      ? b.sort
      : Number.POSITIVE_INFINITY;
    return left === right ? a.id - b.id : left - right;
  });
}

export function planNodeSort<T extends SortableNode>(
  nodes: T[],
  source: string | number,
  target: string | number | null
) {
  const original = sortNodes(nodes);
  const from = original.findIndex((node) => String(node.id) === String(source));
  const to = original.findIndex((node) => String(node.id) === String(target));
  if (from < 0 || to < 0 || from === to) return { items: original, writes: [] };

  const slots = original.map((node) => node.sort);
  const reusableSlots =
    slots.every((slot) => Number.isSafeInteger(slot) && slot > 0) &&
    new Set(slots).size === slots.length;
  const reordered = original.slice();
  const [moved] = reordered.splice(from, 1);
  if (!moved) return { items: original, writes: [] };
  reordered.splice(to, 0, moved);
  const items = reordered.map((node, index) => ({
    ...node,
    sort: reusableSlots ? slots[index]! : index + 1,
  }));
  const oldSlots = new Map(original.map((node) => [node.id, node.sort]));
  const final = items
    .filter((node) => node.sort !== oldSlots.get(node.id))
    .map(({ id, sort }) => ({ id, sort }));
  const highestSlot = slots.reduce(
    (max, slot) => (Number.isSafeInteger(slot) ? Math.max(max, slot) : max),
    items.length
  );

  if (highestSlot + final.length > 2_147_483_647) {
    throw new Error("There are no safe positions available to reorder nodes");
  }

  // The sort endpoint applies its entries in order inside one transaction.
  // Vacate the occupied slots first to respect the database's unique index.
  const temporary = final.map(({ id }, index) => ({
    id,
    sort: highestSlot + index + 1,
  }));
  return { items, writes: [...temporary, ...final] };
}
