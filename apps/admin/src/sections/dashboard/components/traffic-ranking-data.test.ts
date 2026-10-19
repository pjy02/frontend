import { describe, expect, it, vi } from "vitest";
import { createRankingPrefetch } from "./ranking-prefetch";
import { createTrafficRankingDataset } from "./traffic-ranking-data";

const record = (id: number, total: number) => ({
  id,
  sid: id,
  upload: total / 4,
  download: (total * 3) / 4,
});
describe("ranking comparison semantics", () => {
  it("distinguishes missing records from a known zero base without inventing percentages", () => {
    const { items } = createTrafficRankingDataset(
      [record(1, 300), record(2, 200), record(3, 100)],
      [record(2, 0), record(3, 50)]
    );
    expect(items[0]).toMatchObject({
      comparison: "missing",
      growth: null,
      rankChange: undefined,
    });
    expect(items[1]).toMatchObject({
      comparison: "zero-base",
      growth: null,
      absoluteChange: 200,
    });
    expect(items[2]).toMatchObject({
      comparison: "comparable",
      growth: 100,
      absoluteChange: 50,
    });
    expect(items.map((item) => item.total)).toEqual([300, 200, 100]);
    expect(items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(100);
  });
  it("marks an absent comparison dataset as unknown", () => {
    expect(
      createTrafficRankingDataset([record(1, 2)], []).previousAvailable
    ).toBe(false);
    expect(
      createTrafficRankingDataset([record(1, 2)], [record(1, 0)])
        .previousAvailable
    ).toBe(true);
  });
});
describe("background email queue", () => {
  it("limits concurrency and preserves result order without delaying all prefetch until the user tab opens", async () => {
    const run = createRankingPrefetch(4);
    let active = 0;
    let maximum = 0;
    const releases: (() => void)[] = [];
    const jobs = Array.from({ length: 12 }, (_, id) =>
      run(async () => {
        active++;
        maximum = Math.max(active, maximum);
        await new Promise<void>((resolve) => releases.push(resolve));
        active--;
        return id;
      }, new AbortController().signal)
    );
    for (let batch = 0; batch < 3; batch++) {
      await vi.waitFor(() => expect(releases.length).toBe(4));
      for (const release of releases.splice(0)) release();
    }
    expect(await Promise.all(jobs)).toEqual(
      Array.from({ length: 12 }, (_, i) => i)
    );
    expect(maximum).toBe(4);
  });
  it("removes queued aborted reads rather than issuing stale network requests", async () => {
    const run = createRankingPrefetch(1);
    let release!: () => void;
    const first = run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      new AbortController().signal
    );
    const controller = new AbortController();
    const read = vi.fn(async () => "stale");
    const second = run(read, controller.signal);
    const rejected = expect(second).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await first;
    expect(read).not.toHaveBeenCalled();
  });
});
