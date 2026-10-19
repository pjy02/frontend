// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRouteWorkspaceExit } from "./use-route-workspace-exit";

const fixture = vi.hoisted(() => ({
  history: { location: { href: "/dashboard/servers/42?page=3" } },
  error: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: fixture.history }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("sonner", () => ({ toast: { error: fixture.error } }));
beforeEach(() => {
  fixture.history.location.href = "/dashboard/servers/42?page=3";
  vi.clearAllMocks();
});
afterEach(cleanup);

it("retains the routed workspace until its real exit completes, without a timeout", async () => {
  const close = vi.fn();
  const { result } = renderHook(() => useRouteWorkspaceExit(close));
  act(() => result.current.onOpenChange(false));
  expect(result.current.open).toBe(false);
  expect(close).not.toHaveBeenCalled();
  await act(() => result.current.onAfterClose());
  await act(() => result.current.onAfterClose());
  expect(close).toHaveBeenCalledOnce();
});
it("does not navigate back to an obsolete list after a newer route wins", async () => {
  const close = vi.fn();
  const { result, rerender } = renderHook(() => useRouteWorkspaceExit(close));
  act(() => result.current.onOpenChange(false));
  fixture.history.location.href = "/dashboard/product/8";
  rerender();
  expect(result.current.open).toBe(true);
  await act(() => result.current.onAfterClose());
  expect(close).not.toHaveBeenCalled();
});
it("restores the workspace if the final navigation fails", async () => {
  const close = vi.fn().mockRejectedValue(new Error("Navigation failed"));
  const { result } = renderHook(() => useRouteWorkspaceExit(close));
  act(() => result.current.onOpenChange(false));
  await act(() => result.current.onAfterClose());
  expect(result.current.open).toBe(true);
  expect(fixture.error).toHaveBeenCalledOnce();
});
