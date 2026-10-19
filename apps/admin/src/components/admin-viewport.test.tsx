// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminViewport } from "./admin-viewport";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("coalesces keyboard viewport changes and cleans listeners, frames and root variables", () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  const view = render(<AdminViewport />);
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--admin-visible-height")).toBe("844px");
  viewport.height = 420;
  viewport.offsetTop = 20;
  act(() => {
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(32);
  });
  expect(style.getPropertyValue("--admin-visible-height")).toBe("420px");
  expect(style.getPropertyValue("--admin-visible-top")).toBe("20px");
  viewport.scale = 2;
  act(() => {
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(32);
  });
  expect(style.getPropertyValue("--admin-visible-height")).toBe("");
  viewport.scale = 1;
  act(() => viewport.dispatchEvent(new Event("resize")));
  view.unmount();
  act(() => {
    vi.advanceTimersByTime(32);
    viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(32);
  });
  expect(style.getPropertyValue("--admin-visible-height")).toBe("");
  expect(style.getPropertyValue("--admin-visible-top")).toBe("");
});
