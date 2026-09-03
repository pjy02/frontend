import { AnimatePresence, animate, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
  const { reducedMotion } = useAdminMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const displayedRef = useRef(reducedMotion || !animateOnMount ? safeValue : 0);
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

export function DashboardFadeThrough({
  children,
  transitionKey,
}: {
  children: ReactNode;
  transitionKey: string;
}) {
  const { reducedMotion } = useAdminMotion();

  return (
    <motion.div
      className="dashboard-fade-through-stage"
      data-dashboard-fade-through=""
      layout={reducedMotion ? false : "size"}
      transition={{
        layout: {
          duration: reducedMotion ? 0 : 0.24,
          ease: [0.2, 0, 0, 1],
        },
      }}
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          animate={
            reducedMotion
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  scale: 1,
                  transition: {
                    delay: 0.06,
                    duration: 0.18,
                    ease: [0.2, 0, 0, 1],
                  },
                }
          }
          className="dashboard-fade-through-panel"
          data-dashboard-transition-key={transitionKey}
          exit={
            reducedMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  scale: 0.985,
                  transition: {
                    duration: 0.09,
                    ease: [0.4, 0, 1, 1],
                  },
                }
          }
          initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
          key={transitionKey}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
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
