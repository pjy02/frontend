import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import { useAdminMotion } from "./motion-provider";

const ContentReadyContext = createContext<(() => void) | null>(null);

/** This sentinel commits only when the Suspense content, not its fallback, is ready. */
export function AdminContentReady() {
  const ready = useContext(ContentReadyContext);
  useLayoutEffect(() => ready?.(), [ready]);
  return null;
}

/** Animate a persistent wrapper; a visual transition must never remount Outlet. */
export function AdminPageTransition({
  transitionKey,
  children,
  waitForContent = false,
  skip = false,
  onReady,
}: {
  transitionKey: string;
  children: ReactNode;
  waitForContent?: boolean;
  skip?: boolean;
  onReady?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastTransitionKey = useRef<string | undefined>(undefined);
  const animation = useRef<Animation | null>(null);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const { reducedMotion, presets } = useAdminMotion();
  const enter = useCallback(() => {
    const element = ref.current;
    if (lastTransitionKey.current === transitionKey) return;
    lastTransitionKey.current = transitionKey;
    readyCallback.current?.();
    animation.current?.cancel();
    if (
      !element ||
      skip ||
      reducedMotion ||
      typeof element.animate !== "function"
    )
      return;
    // Native transient effects do not cache/write opacity into a persistent
    // element's inline styles when StrictMode, Suspense or navigation interrupts.
    animation.current = element.animate(
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
  }, [transitionKey, reducedMotion, presets.navigation, skip]);
  useLayoutEffect(() => {
    if (!waitForContent) enter();
    return () => {
      animation.current?.cancel();
      animation.current = null;
    };
  }, [enter, waitForContent]);
  return (
    <div className="admin-content__inner admin-page-transition" ref={ref}>
      <ContentReadyContext.Provider value={waitForContent ? enter : null}>
        {children}
      </ContentReadyContext.Provider>
    </div>
  );
}
