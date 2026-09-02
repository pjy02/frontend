"use client";

import type {
  DotLottie,
  DotLottieReactProps,
} from "@lottiefiles/dotlottie-react";
import type { ComponentProps } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils";

// dotlottie-react ships a ~550KB inlined WASM player; load it on demand so
// decorative animations never block first paint.
const LazyDotLottie = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({
    default: m.DotLottieReact,
  }))
);

export function DotLottieReact(props: ComponentProps<typeof LazyDotLottie>) {
  const { className, ...playerProps } = props;
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={cn(
            "rounded-md bg-muted/30 motion-safe:animate-pulse",
            className
          )}
          data-slot="lottie-placeholder"
        />
      }
    >
      <LazyDotLottie {...playerProps} className={className} />
    </Suspense>
  );
}

interface DeferredDotLottieProps
  extends Omit<DotLottieReactProps, "className"> {
  className?: string;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Defers decorative animations until they are close to the viewport, pauses
 * them while off-screen, and avoids loading them for reduced-motion users.
 * The className is applied to the stable container so it also works as the
 * placeholder before the player is downloaded.
 */
export function DeferredDotLottie({
  autoplay,
  className,
  dotLottieRefCallback,
  rootMargin = "0px",
  threshold = 0.25,
  ...props
}: DeferredDotLottieProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<DotLottie | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(
          entry?.isIntersecting && entry.intersectionRatio >= threshold
        );
        setIsVisible(visible);
        if (visible) {
          setShouldRender(true);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  useEffect(() => {
    if (!(autoplay && isVisible) || prefersReducedMotion) {
      playerRef.current?.pause();
      return;
    }

    playerRef.current?.play();
  }, [autoplay, isVisible, prefersReducedMotion]);

  const setPlayerRef = useCallback(
    (player: DotLottie | null) => {
      playerRef.current = player;
      dotLottieRefCallback?.(player);
    },
    [dotLottieRefCallback]
  );

  return (
    <div className={className} ref={containerRef}>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="size-full rounded-[inherit] bg-muted/30 motion-safe:animate-pulse"
            data-slot="lottie-placeholder"
          />
        }
      >
        {shouldRender && !prefersReducedMotion ? (
          <LazyDotLottie
            {...props}
            autoplay={Boolean(autoplay && isVisible)}
            className="size-full"
            dotLottieRefCallback={setPlayerRef}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
