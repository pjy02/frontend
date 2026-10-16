import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useAdminMotion } from "./motion-provider";

/** Animate a persistent wrapper; a visual transition must never remount Outlet. */
export function AdminPageTransition({
  transitionKey,
  children,
}: {
  transitionKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTransitionKey = useRef<string | undefined>(undefined);
  const { reducedMotion, presets } = useAdminMotion();
  useLayoutEffect(() => {
    const element = ref.current;
    if (lastTransitionKey.current === transitionKey) return;
    lastTransitionKey.current = transitionKey;
    if (!element || reducedMotion || typeof element.animate !== "function")
      return;
    // Native transient effects do not cache/write opacity into a persistent
    // element's inline styles when StrictMode, Suspense or navigation interrupts.
    const controls = element.animate(
      [
        {
          opacity: 0,
          transform: `translateY(${presets.navigation.distance}px)`,
        },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: presets.navigation.durationMs,
        easing: `cubic-bezier(${presets.navigation.transition.ease.join(",")})`,
        fill: "none",
      }
    );
    return () => controls.cancel();
  }, [transitionKey, reducedMotion, presets.navigation]);
  return (
    <div className="admin-content__inner admin-page-transition" ref={ref}>
      {children}
    </div>
  );
}
