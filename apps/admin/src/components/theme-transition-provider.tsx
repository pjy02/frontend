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
        };
      }
    );
    controller.current = instance;
    const frames = new Set<number>();
    const interruptPointer = (event: PointerEvent) => {
      const target = instance.interruptPointer(event);
      if (!target) return;
      event.preventDefault();
      const frame = requestAnimationFrame(() => {
        frames.delete(frame);
        if (!target.isConnected) return;
        target.focus({ preventScroll: true });
        target.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            isPrimary: true,
            clientX: event.clientX,
            clientY: event.clientY,
          })
        );
      });
      frames.add(frame);
    };
    const cancel = () => instance.cancelVisual();
    const unsubscribe = navigation?.subscribe(cancel);
    const hidden = () => {
      if (document.hidden) cancel();
    };
    const system = matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("hashchange", cancel);
    window.addEventListener("resize", cancel);
    window.visualViewport?.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerdown", interruptPointer, true);
    system.addEventListener("change", cancel);
    return () => {
      instance.dispose();
      unsubscribe?.();
      for (const frame of frames) cancelAnimationFrame(frame);
      controller.current = null;
      window.removeEventListener("hashchange", cancel);
      window.removeEventListener("resize", cancel);
      window.visualViewport?.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerdown", interruptPointer, true);
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
