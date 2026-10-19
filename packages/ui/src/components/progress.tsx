"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";
import { useMotionProfile } from "./motion-profile";

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const motion = useMotionProfile();
  const maximum = Number.isFinite(max) && max > 0 ? max : 100;
  const percentage =
    value != null && Number.isFinite(value)
      ? Math.min(maximum, Math.max(0, value))
      : null;
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      data-slot="progress"
      max={maximum}
      value={percentage}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        data-slot="progress-indicator"
        style={{
          ...(motion
            ? {
                transitionProperty: "transform",
                transitionDuration: `${motion.presets.state.durationMs}ms`,
                transitionTimingFunction: `cubic-bezier(${motion.presets.state.transition.ease.join(",")})`,
              }
            : {}),
          transform: `translateX(-${100 - ((percentage ?? 0) / maximum) * 100}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
