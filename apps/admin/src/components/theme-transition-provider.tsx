import { type Theme, useTheme } from "@workspace/ui/integrations/theme";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import { useAdminMotion } from "./motion-provider";
import { createThemeTransition } from "./theme-transition";

const ThemeTransitionContext = createContext<
  ((next: Theme, trigger: HTMLButtonElement | null) => void) | undefined
>(undefined);

export function AdminThemeTransitionProvider({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation?: { subscribe: (listener: () => void) => () => void };
}) {
  const { setTheme } = useTheme();
  const { reducedMotion, presets } = useAdminMotion();
  const latest = useRef({ setTheme, reducedMotion, presets });
  latest.current = { setTheme, reducedMotion, presets };
  const controller = useRef<ReturnType<typeof createThemeTransition> | null>(
    null
  );
  useEffect(() => {
    let pointer: { x: number; y: number; type: string } | undefined;
    const instance = createThemeTransition(
      (next) => flushSync(() => latest.current.setTheme(next)),
      () => {
        const { presets, reducedMotion } = latest.current;
        const token =
          innerWidth < 768 ? presets.themeRevealCompact : presets.themeReveal;
        return {
          reduced: reducedMotion,
          duration: token.durationMs,
          easing: `cubic-bezier(${token.transition.ease.join(",")})`,
          interactionSafe: () => {
            // A touch-start is hit-tested against the root snapshot, before
            // Vaul/Radix's pointer-down triggers can see it. Until native VT
            // exposes live hit testing, touch-capable devices use a direct update.
            if (
              navigator.maxTouchPoints > 0 ||
              matchMedia("(any-pointer: coarse)").matches
            )
              return false;
            if (!pointer || pointer.type !== "mouse") return true;
            // Root View Transitions suppress live hit testing. Never capture a
            // stationary pointer over an actionable target; movement cancels below.
            return !document
              .elementFromPoint(pointer.x, pointer.y)
              ?.closest(
                'button, a[href], input, textarea, select, summary, [role="button"], [role="menuitem"], [role="tab"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
              );
          },
        };
      }
    );
    controller.current = instance;
    const cancel = () => instance.cancelVisual();
    const interruptPointer = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY, type: event.pointerType };
      cancel();
    };
    // End the visual before the next interaction. Never prevent, synthesize or
    // replay an event; the browser remains the sole owner of business input.
    const interactions = [
      "keydown",
      "beforeinput",
      "wheel",
      "scroll",
      "focusin",
    ] as const;
    const unsubscribe = navigation?.subscribe(cancel);
    const hidden = () => {
      if (document.hidden) cancel();
    };
    const system = matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("hashchange", cancel);
    window.addEventListener("resize", cancel);
    window.addEventListener("pagehide", cancel);
    window.visualViewport?.addEventListener("resize", cancel);
    window.visualViewport?.addEventListener("scroll", cancel);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerdown", interruptPointer, true);
    document.addEventListener("pointermove", interruptPointer, true);
    for (const type of interactions)
      document.addEventListener(type, cancel, { capture: true, passive: true });
    system.addEventListener("change", cancel);
    return () => {
      instance.dispose();
      unsubscribe?.();
      controller.current = null;
      window.removeEventListener("hashchange", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("pagehide", cancel);
      window.visualViewport?.removeEventListener("resize", cancel);
      window.visualViewport?.removeEventListener("scroll", cancel);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerdown", interruptPointer, true);
      document.removeEventListener("pointermove", interruptPointer, true);
      for (const type of interactions)
        document.removeEventListener(type, cancel, true);
      system.removeEventListener("change", cancel);
    };
  }, [navigation]);
  useEffect(() => {
    if (reducedMotion) controller.current?.cancelVisual();
  }, [reducedMotion]);

  return (
    <ThemeTransitionContext
      value={(next, trigger) => {
        const current = controller.current;
        if (current)
          current.change(next, trigger).catch(() => {
            /* Feature failures already fall back in the controller. */
          });
        else setTheme(next);
      }}
    >
      {children}
    </ThemeTransitionContext>
  );
}

export function useAdminThemeTransition() {
  return useContext(ThemeTransitionContext);
}
