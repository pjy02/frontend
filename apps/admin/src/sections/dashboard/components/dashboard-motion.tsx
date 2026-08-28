import { AnimatePresence, animate, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAdminMotion } from "@/components/motion-provider";

export function AnimatedNumber({
  className,
  format = (value) => Math.round(value).toLocaleString(),
  value,
}: {
  className?: string;
  format?: (value: number) => string;
  value: number;
}) {
  const { reducedMotion } = useAdminMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const displayedRef = useRef(reducedMotion ? safeValue : 0);
  const [displayed, setDisplayed] = useState(displayedRef.current);

  useEffect(() => {
    const from = displayedRef.current;
    if (reducedMotion) {
      displayedRef.current = safeValue;
      setDisplayed(safeValue);
      return;
    }
    const controls = animate(from, safeValue, {
      duration: 0.58,
      ease: [0.05, 0.7, 0.1, 1],
      onUpdate: (latest) => {
        displayedRef.current = latest;
        setDisplayed(latest);
      },
    });
    return () => controls.stop();
  }, [reducedMotion, safeValue]);

  return (
    <span className={className} data-dashboard-animated-number="">
      <span aria-hidden="true">{format(displayed)}</span>
      <span className="sr-only">{format(safeValue)}</span>
    </span>
  );
}

export function DashboardDataTransition({
  children,
  transitionKey,
}: {
  children: ReactNode;
  transitionKey: string;
}) {
  const { reducedMotion } = useAdminMotion();
  return (
    <AnimatePresence initial={!reducedMotion} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-data-transition h-full w-full"
        exit={reducedMotion ? undefined : { opacity: 0, y: -3 }}
        initial={reducedMotion ? false : { opacity: 0, y: 3 }}
        key={transitionKey}
        transition={{
          duration: reducedMotion ? 0 : 0.16,
          ease: [0.2, 0, 0, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
