// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardScroll } from "./use-dashboard-scroll";

const mocks = vi.hoisted(() => ({
  key: "one",
  pathname: "/dashboard",
  saved: { scrollX: 0, scrollY: 500 },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: any) => select({ state: { __TSR_key: mocks.key } }),
  useMatch: () => "/dashboard",
  useElementScrollRestoration: () => mocks.saved,
  useRouter: () => router,
}));
const router = {
  history: {
    location: {
      get pathname() {
        return mocks.pathname;
      },
    },
  },
};
beforeEach(() => {
  vi.useFakeTimers();
  mocks.pathname = "/dashboard";
  mocks.saved = { scrollX: 0, scrollY: 500 };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {
    /* jsdom has no layout viewport. */
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("dashboard deferred scroll", () => {
  it("waits for account layout and data before restoring", () => {
    mocks.key = "wait";
    const hook = renderHook(({ ready }) => useDashboardScroll(ready, "1"), {
      initialProps: { ready: false },
    });
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).not.toHaveBeenCalled();
    hook.rerender({ ready: true });
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 0,
      top: 500,
      behavior: "instant",
    });
  });
  it("lets user scrolling cancel the pending restoration", () => {
    mocks.key = "cancel";
    const hook = renderHook(({ ready }) => useDashboardScroll(ready, "1"), {
      initialProps: { ready: false },
    });
    act(() => window.dispatchEvent(new Event("wheel")));
    hook.rerender({ ready: true });
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it("does not scroll a destination route when the old dashboard is leaving", () => {
    mocks.key = "leaving";
    renderHook(() => useDashboardScroll(true, "1"));
    mocks.pathname = "/dashboard/user";
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it("keeps a gesture cancellation when the account/layout scope arrives late", () => {
    mocks.key = "late-account";
    const hook = renderHook(
      ({ ready, account }: { ready: boolean; account: string | null }) =>
        useDashboardScroll(ready, account),
      {
        initialProps: { ready: false, account: null as string | null },
      }
    );
    act(() => window.dispatchEvent(new Event("wheel")));
    hook.rerender({ ready: true, account: "loaded-account" });
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).not.toHaveBeenCalled();
    mocks.key = "new-history-entry";
    hook.rerender({ ready: true, account: "loaded-account" });
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 0,
      top: 500,
      behavior: "instant",
    });
  });
  it("lets input between the two restoration frames take precedence", () => {
    mocks.key = "between-frames";
    renderHook(() => useDashboardScroll(true, "1"));
    act(() => vi.advanceTimersByTime(17));
    act(() => window.dispatchEvent(new Event("pointerdown")));
    act(() => vi.advanceTimersByTime(64));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
