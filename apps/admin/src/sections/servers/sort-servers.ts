import { postServerServerSort } from "@workspace/ui/services/admin/admin";

/** Work only on snapshots. Never reorder/mutate the table's live array or records. */
export async function saveServerOrder(
  source: string | number,
  target: string | number | null,
  items: API.Server[]
) {
  const from = items.findIndex((item) => String(item.id) === String(source));
  const to = items.findIndex((item) => String(item.id) === String(target));
  if (from < 0 || to < 0 || from === to) return { items, changed: false };
  const original = new Map(items.map((item) => [item.id, item.sort]));
  const slots = items.map((item) => item.sort);
  const validSlots =
    slots.every((slot) => Number.isFinite(slot)) &&
    new Set(slots).size === slots.length;
  const descending = (slots[0] ?? 0) > (slots.at(-1) ?? 0);
  const reordered = items.map((item) => ({ ...item }));
  const [moved] = reordered.splice(from, 1);
  if (!moved) return { items, changed: false };
  reordered.splice(to, 0, moved);
  const updated = reordered.map((item, index) => ({
    ...item,
    sort: validSlots
      ? slots[index]!
      : descending
        ? items.length - index
        : index + 1,
  }));
  const changed = updated.filter((item) => item.sort !== original.get(item.id));
  await postServerServerSort({
    sort: changed.map(({ id, sort }) => ({ id, sort })),
  });
  return { items: updated, changed: true };
}
