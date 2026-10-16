import { describe, expect, it, vi } from "vitest";
import { freshnessState, refreshDashboardSources } from "./data-freshness";

describe("dashboard data freshness", () => {
  it("distinguishes missing data, a real zero, refresh and stale values", () => {
    const base = {
      data: undefined,
      dataUpdatedAt: 0,
      isError: false,
      isFetching: true,
    };
    expect(freshnessState(base)).toBe("loading");
    expect(freshnessState({ ...base, isError: true })).toBe("unavailable");
    expect(freshnessState({ ...base, isFetching: false })).toBe("empty");
    expect(freshnessState({ ...base, data: 0, isFetching: false })).toBe(
      "ready"
    );
    expect(
      freshnessState({ ...base, data: { count: 23 }, isError: true })
    ).toBe("stale");
    expect(freshnessState({ ...base, data: { count: 23 } })).toBe("refreshing");
  });
  it("waits for every source and counts both rejected requests and resolved query errors", async () => {
    let finish!: (result: { isError: boolean; data: unknown }) => void;
    const slow = new Promise<{ isError: boolean; data: unknown }>((resolve) => {
      finish = resolve;
    });
    const sources = [
      { refetch: vi.fn(async () => ({ isError: false, data: 0 })) },
      {
        refetch: vi.fn(async () => ({
          isError: true,
          data: { previous: true },
        })),
      },
      {
        refetch: vi.fn(async () => {
          throw new Error("network");
        }),
      },
      { refetch: vi.fn(() => slow) },
    ];
    const settled = vi.fn();
    const result = refreshDashboardSources(sources).then((value) => {
      settled(value);
      return value;
    });
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finish({ isError: false, data: { count: 9 } });
    expect(await result).toEqual({ failed: 2, total: 4 });
    sources.forEach((source) => {
      expect(source.refetch).toHaveBeenCalledTimes(1);
    });
  });
  it("does not treat an empty successful response as updated business data", async () => {
    expect(
      await refreshDashboardSources([
        { refetch: async () => ({ isError: false, data: undefined }) },
      ])
    ).toEqual({ failed: 1, total: 1 });
  });
});
