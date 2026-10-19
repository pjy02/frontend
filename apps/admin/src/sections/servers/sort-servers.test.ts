import { afterEach, describe, expect, it, vi } from "vitest";
import { saveServerOrder } from "./sort-servers";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  postServerServerSort: mocks.save,
}));
afterEach(() => vi.resetAllMocks());
const fixture = () =>
  [1, 2, 3].map(
    (id) => ({ id, sort: id * 10, name: `Server ${id}` }) as API.Server
  );

describe("server sorting transaction", () => {
  it("waits for the write and preserves the live array and records", async () => {
    let finish: (() => void) | undefined;
    mocks.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const records = fixture();
    const snapshot = structuredClone(records);
    let completed = false;
    const result = saveServerOrder("1", "3", records).then((value) => {
      completed = true;
      return value;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(records).toEqual(snapshot);
    finish?.();
    expect((await result).items.map((item) => [item.id, item.sort])).toEqual([
      [2, 10],
      [3, 20],
      [1, 30],
    ]);
    expect(records).toEqual(snapshot);
    expect(mocks.save).toHaveBeenCalledWith({
      sort: [
        { id: 2, sort: 10 },
        { id: 3, sort: 20 },
        { id: 1, sort: 30 },
      ],
    });
  });
  it("propagates a failed write without mutating the snapshot", async () => {
    mocks.save.mockRejectedValue(new Error("write failed"));
    const records = fixture();
    const snapshot = structuredClone(records);
    await expect(saveServerOrder(3, 1, records)).rejects.toThrow(
      "write failed"
    );
    expect(records).toEqual(snapshot);
  });
  it("does not report success or write for invalid and unchanged drops", async () => {
    expect((await saveServerOrder(1, 1, fixture())).changed).toBe(false);
    expect((await saveServerOrder(1, null, fixture())).changed).toBe(false);
    expect((await saveServerOrder(9, 1, fixture())).changed).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("normalizes duplicate positions so a reorder really survives the next read", async () => {
    mocks.save.mockResolvedValue(undefined);
    const records = fixture().map((item) => ({ ...item, sort: 0 }));
    const result = await saveServerOrder(3, 1, records);
    expect(result.items.map((item) => [item.id, item.sort])).toEqual([
      [3, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(records.every((item) => item.sort === 0)).toBe(true);
  });
});
