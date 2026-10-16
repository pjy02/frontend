import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAdminMotion } from "@/components/motion-provider";

export function AnimatedNumber({
  animateOnMount = true,
  className,
  format = (value) => Math.round(value).toLocaleString(),
  value,
}: {
  animateOnMount?: boolean;
  className?: string;
  format?: (value: number) => string;
  value: number;
}) {
  const { reducedMotion, presets } = useAdminMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const displayedRef = useRef(reducedMotion || !animateOnMount ? safeValue : 0);
  const textRef = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
    const text = format(displayedRef.current);
    if (textRef.current && textRef.current.textContent !== text)
      textRef.current.textContent = text;
  }, [format]);

  useEffect(() => {
    const from = displayedRef.current;
    const paint = (latest: number) => {
      displayedRef.current = latest;
      const text = formatRef.current(latest);
      if (textRef.current && textRef.current.textContent !== text) {
        textRef.current.textContent = text;
      }
    };
    if (reducedMotion) {
      paint(safeValue);
      return;
    }
    if (from === safeValue) return;
    const controls = animate(from, safeValue, {
      ...presets.number.transition,
      onUpdate: paint,
    });
    return () => controls.stop();
  }, [reducedMotion, safeValue, presets.number]);

  return (
    <span className={className} data-dashboard-animated-number="">
      <span aria-hidden="true" ref={textRef}>
        {format(displayedRef.current)}
      </span>
      <span className="sr-only">{format(safeValue)}</span>
    </span>
  );
}

export function DashboardFadeThrough({
  children,
  transitionKey,
}: {
  children: ReactNode;
  transitionKey: string;
}) {
  const { reducedMotion, presets } = useAdminMotion();
  const sharedOpacity = useContext(DashboardCategoryMotion);
  const localOpacity = useMotionValue(1);
  useEffect(() => {
    if (sharedOpacity) return;
    if (reducedMotion) {
      localOpacity.set(1);
      return;
    }
    const controls = animate(
      localOpacity,
      [0.7, 1],
      presets.categoryEnter.transition
    );
    return () => controls.stop();
  }, [
    transitionKey,
    sharedOpacity,
    reducedMotion,
    localOpacity,
    presets.categoryEnter,
  ]);

  return (
    <motion.div
      className="dashboard-fade-through-stage"
      data-dashboard-fade-through=""
      style={{ opacity: sharedOpacity || localOpacity }}
    >
      <div
        className="dashboard-fade-through-panel"
        data-dashboard-transition-key={transitionKey}
      >
        {children}
      </div>
    </motion.div>
  );
}

/** One owner/clock for category-dependent summaries and rows. No exit queue. */
export const DashboardCategoryMotion =
  createContext<MotionValue<number> | null>(null);

export function useDashboardCategory<T>(key: string, value: T) {
  const { reducedMotion, presets } = useAdminMotion();
  const opacity = useMotionValue(1);
  const latest = useRef({ key, value });
  latest.current = { key, value };
  const committed = useRef(latest.current);
  const [displayedKey, setDisplayedKey] = useState(key);
  if (displayedKey === key) committed.current = latest.current;

  useLayoutEffect(() => {
    if (reducedMotion) {
      committed.current = latest.current;
      setDisplayedKey(key);
      opacity.set(1);
      return;
    }
    let cancelled = false;
    const switching = displayedKey !== key;
    const controls = animate(
      opacity,
      switching ? 0 : 1,
      switching
        ? presets.categoryExit.transition
        : presets.categoryEnter.transition
    );
    if (switching) {
      controls.then(() => {
        if (cancelled) return;
        committed.current = latest.current;
        setDisplayedKey(latest.current.key);
      });
    }
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [
    key,
    displayedKey,
    reducedMotion,
    opacity,
    presets.categoryEnter,
    presets.categoryExit,
  ]);

  return {
    opacity,
    value:
      reducedMotion || displayedKey === key ? value : committed.current.value,
  };
}

export function DashboardDataTransition({
  children,
  transitionKey,
}: {
  children: ReactNode;
  transitionKey: string;
}) {
  const { reducedMotion, presets } = useAdminMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (reducedMotion || !element) return;
    const controls = animate(
      element,
      { opacity: [0.8, 1] },
      presets.state.transition
    );
    return () => {
      controls.stop();
      element.style.opacity = "";
    };
  }, [transitionKey, reducedMotion, presets.state]);
  return (
    <div
      className="dashboard-data-transition h-full w-full"
      data-dashboard-data-key={transitionKey}
      ref={ref}
    >
      {children}
    </div>
  );
}

/** Height has one owner; row counts/empty states may change without moving the
 * controls or scaling text. The inner natural layout is never transformed. */
export function DashboardHeightRegion({ children }: { children: ReactNode }) {
  const { reducedMotion, presets } = useAdminMotion();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = outer.current,
      content = inner.current;
    if (!(region && content) || typeof ResizeObserver === "undefined") return;
    let height = content.getBoundingClientRect().height;
    let controls: ReturnType<typeof animate> | undefined;
    const observer = new ResizeObserver(() => {
      const next = content.getBoundingClientRect().height;
      if (Math.abs(next - height) < 1) return;
      const from = controls ? region.getBoundingClientRect().height : height;
      height = next;
      controls?.stop();
      if (reducedMotion) {
        region.style.height = "";
        controls = undefined;
        return;
      }
      region.style.height = `${from}px`;
      const current = animate(
        region,
        { height: next },
        presets.categoryLayout.transition
      );
      controls = current;
      current.then(() => {
        if (controls !== current) return;
        region.style.height = "";
        controls = undefined;
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      controls?.stop();
      controls = undefined;
      region.style.height = "";
    };
  }, [reducedMotion, presets.categoryLayout]);
  return (
    <div className="overflow-clip" data-dashboard-height-region ref={outer}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
