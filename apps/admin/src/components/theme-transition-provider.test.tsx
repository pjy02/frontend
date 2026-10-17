// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { ThemeProvider } from "@workspace/ui/integrations/theme";
import { afterEach, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import { AdminThemeTransitionProvider } from "./theme-transition-provider";

const actions = vi.hoisted(() => ({
  cancelVisual: vi.fn(),
  dispose: vi.fn(),
  change: vi.fn(),
  interruptPointer: vi.fn(),
}));
vi.mock("./theme-transition", () => ({ createThemeTransition: () => actions }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
