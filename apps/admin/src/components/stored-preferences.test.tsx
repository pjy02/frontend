// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useStoredPreference } from "@workspace/ui/hooks/use-stored-preference";
import { afterEach, describe, expect, it, vi } from "vitest";

const parse = (raw: string | null) => {
  try {
    return Number(JSON.parse(raw || "0")) || 0;
  } catch {
    return 0;
  }
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("account scoped browser preferences", () => {
  it("saves edits but neither reads nor writes another account when scopes change", () => {
    localStorage.setItem("account-b", "9");
    const hook = renderHook(({ name }) => useStoredPreference(name, parse), {
      initialProps: { name: "account-a" as string | null },
    });
    act(() => hook.result.current[1](4));
    expect(localStorage.getItem("account-a")).toBe("4");
    hook.rerender({ name: "account-b" });
    expect(hook.result.current[0]).toBe(9);
    hook.rerender({ name: null });
    expect(hook.result.current[0]).toBe(0);
    act(() => hook.result.current[1](5));
    expect(localStorage.getItem("account-b")).toBe("9");
    hook.rerender({ name: "account-a" });
    expect(hook.result.current[0]).toBe(4);
  });
  it("keeps working in memory when storage is blocked and reports that it was not saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    const hook = renderHook(() => useStoredPreference("account-a", parse));
    act(() => hook.result.current[1](3));
    expect(hook.result.current[0]).toBe(3);
    expect(hook.result.current[2]).toBe(true);
  });
  it("receives cross-tab updates only for the current scope", () => {
    const hook = renderHook(() => useStoredPreference("account-a", parse));
    act(() => {
      localStorage.setItem("account-a", "7");
      window.dispatchEvent(new StorageEvent("storage", { key: "account-b" }));
    });
    expect(hook.result.current[0]).toBe(0);
    act(() =>
      window.dispatchEvent(new StorageEvent("storage", { key: "account-a" }))
    );
    expect(hook.result.current[0]).toBe(7);
  });
});
