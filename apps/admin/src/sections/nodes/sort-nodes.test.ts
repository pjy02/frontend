import { expect, it } from "vitest";
import { planNodeSort } from "./sort-nodes";

it("moves nodes across the global order without colliding with occupied sort positions", () => {
  const nodes = [
    { id: 1, sort: 10 },
    { id: 2, sort: 30 },
    { id: 3, sort: 50 },
  ];
  const { items, writes } = planNodeSort(nodes, 3, 1);
  const stored = new Map(nodes.map(({ id, sort }) => [id, sort]));
  for (const { id, sort } of writes) {
    expect([...stored.values()]).not.toContain(sort);
    stored.set(id, sort);
  }
  expect(items).toEqual([
    { id: 3, sort: 10 },
    { id: 1, sort: 30 },
    { id: 2, sort: 50 },
  ]);
  expect([...stored].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual([
    3, 1, 2,
  ]);
  expect(nodes.map(({ sort }) => sort)).toEqual([10, 30, 50]);
});

it("repairs legacy duplicate or missing positions in a complete inventory", () => {
  const { items, writes } = planNodeSort(
    [
      { id: 1, sort: 0 },
      { id: 2, sort: 0 },
    ],
    2,
    1
  );
  expect(items).toEqual([
    { id: 2, sort: 1 },
    { id: 1, sort: 2 },
  ]);
  expect(writes.map(({ sort }) => sort)).toEqual([3, 4, 1, 2]);
});
