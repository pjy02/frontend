import { afterEach, expect, it, vi } from "vitest";
import { createInventoryCache } from "./inventory-cache";

const events = () => ({ loading: vi.fn(), success: vi.fn(), failure: vi.fn() });

afterEach(() => {
  vi.useRealTimers();
});

it("shares one short-lived read across callers without sharing their cancellation", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue([1]);
  const read = createInventoryCache(load, events());
  const caller = new AbortController();
  const first = read({ signal: caller.signal });
  const second = read();
  caller.abort();
  await expect(first).rejects.toHaveProperty("name", "AbortError");
  await expect(second).resolves.toEqual([1]);
  await expect(read()).resolves.toEqual([1]);
  expect(load).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(30_001);
  await read();
  expect(load).toHaveBeenCalledTimes(2);
});

it("a post-write refresh supersedes an in-flight response and shares the latest result", async () => {
  let finishFirst: ((items: number[]) => void) | undefined;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        })
    )
    .mockResolvedValueOnce([2]);
  const update = events();
  const read = createInventoryCache(load, update);
  const first = read();
  await expect(read({ refresh: true })).resolves.toEqual([2]);
  expect(finishFirst).toBeTypeOf("function");
  finishFirst?.([1]);
  await expect(first).resolves.toEqual([2]);
  expect(update.success).toHaveBeenCalledExactlyOnceWith([2]);
  expect(load.mock.calls[0]?.[0].aborted).toBe(true);
});

it("lets a failed manual refresh be retried without serving stale data as current", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce([1])
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce([2]);
  const update = events();
  const read = createInventoryCache(load, update);
  await read();
  await expect(read({ refresh: true })).rejects.toThrow("Offline");
  expect(update.failure).toHaveBeenCalledOnce();
  await expect(read()).resolves.toEqual([2]);
});
