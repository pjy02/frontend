// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@workspace/ui/integrations/theme";
import { afterEach, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import { AdminThemeTransitionProvider } from "./theme-transition-provider";

const actions = vi.hoisted(() => ({
  cancelVisual: vi.fn(),
  dispose: vi.fn(),
  change: vi.fn(),
  settings: undefined as undefined | (() => { interactionSafe: () => boolean }),
}));
vi.mock("./theme-transition", () => ({
  createThemeTransition: (
    _commit: unknown,
    settings: typeof actions.settings
  ) => {
    actions.settings = settings;
    return actions;
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, "maxTouchPoints");
  Reflect.deleteProperty(document, "elementFromPoint");
});

it("interrupts before input without preventing or replaying it and falls back on touch devices", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const clicked = vi.fn();
  render(
    <ThemeProvider>
      <MotionProvider>
        <AdminThemeTransitionProvider>
          <button onPointerDown={clicked} type="button">
            Business action
          </button>
        </AdminThemeTransitionProvider>
      </MotionProvider>
    </ThemeProvider>
  );
  const button = screen.getByRole("button", { name: "Business action" });
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  button.dispatchEvent(event);
  expect(clicked).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(false);
  const count = actions.cancelVisual.mock.calls.length;
  for (const type of ["keydown", "beforeinput", "wheel", "scroll"])
    fireEvent(button, new Event(type, { bubbles: true }));
  expect(actions.cancelVisual).toHaveBeenCalledTimes(count + 4);
  const pointer = new Event("pointermove", { bubbles: true });
  Object.defineProperties(pointer, {
    pointerType: { value: "mouse" },
    clientX: { value: 10 },
    clientY: { value: 10 },
  });
  fireEvent(button, pointer);
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => button,
  });
  expect(actions.settings?.().interactionSafe()).toBe(false);
  const main = document.createElement("main");
  main.tabIndex = -1;
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => main,
  });
  expect(actions.settings?.().interactionSafe()).toBe(true);
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: 1,
  });
  expect(actions.settings?.().interactionSafe()).toBe(false);
});

it("cancels native snapshots on router history notifications and unsubscribes on unmount", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  let changed!: () => void;
  const unsubscribe = vi.fn();
  const navigation = {
    subscribe: vi.fn((listener: () => void) => {
      changed = listener;
      return unsubscribe;
    }),
  };
  const view = render(
    <ThemeProvider>
      <MotionProvider>
        <AdminThemeTransitionProvider navigation={navigation}>
          <p>Content</p>
        </AdminThemeTransitionProvider>
      </MotionProvider>
    </ThemeProvider>
  );
  expect(navigation.subscribe).toHaveBeenCalledTimes(1);
  changed();
  expect(actions.cancelVisual).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("resize"));
  expect(actions.cancelVisual).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(actions.dispose).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("resize"));
  expect(actions.cancelVisual).toHaveBeenCalledTimes(2);
});
