// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EstimateStatus, useLatestEstimate } from "./use-latest-estimate";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("retries an estimate without submitting the surrounding campaign form", () => {
  const retry = vi.fn();
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <EstimateStatus error retry={retry} />
    </form>
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});

it("publishes only the newest conditions even when the old request finishes last", async () => {
  vi.useFakeTimers();
  let finishA!: (count: number) => void;
  let finishB!: (count: number) => void;
  const a = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finishA = resolve;
      })
  );
  const b = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finishB = resolve;
      })
  );
  const view = renderHook(
    ({ key, calculate }) => useLatestEstimate(key, true, calculate),
    { initialProps: { key: "a", calculate: a } }
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  view.rerender({ key: "b", calculate: b });
  expect(view.result.current.data).toBeUndefined();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
    finishB(42);
  });
  expect(view.result.current.data).toBe(42);
  await act(async () => finishA(9));
  expect(view.result.current.data).toBe(42);
});

it("keeps unknown counts unknown on failure, allows retry, and accepts a real zero", async () => {
  vi.useFakeTimers();
  const calculate = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(0);
  const view = renderHook(() => useLatestEstimate("same", true, calculate));
  expect(view.result.current.data).toBeUndefined();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(view.result.current.error).toBe(true);
  expect(view.result.current.data).toBeUndefined();
  act(() => view.result.current.retry());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(view.result.current.error).toBe(false);
  expect(view.result.current.data).toBe(0);
});

it("debounces rapid changes and discards a response after closing", async () => {
  vi.useFakeTimers();
  let finish!: (value: number) => void;
  const calculate = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      })
  );
  const view = renderHook(
    ({ key, open }) => useLatestEstimate(key, open, calculate),
    { initialProps: { key: "a", open: true } }
  );
  view.rerender({ key: "b", open: true });
  view.rerender({ key: "c", open: true });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(calculate).toHaveBeenCalledOnce();
  view.rerender({ key: "c", open: false });
  await act(async () => finish(100));
  expect(view.result.current.data).toBeUndefined();
});
