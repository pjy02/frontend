import {
  MotionProfileProvider,
  useMotionProfile,
} from "@workspace/ui/components/motion-profile";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import {
  type MotionProfile,
  motionCssVariables,
} from "@workspace/ui/lib/motion-profile";
import { type ReactNode, useLayoutEffect } from "react";
import { AdminViewport } from "./admin-viewport";
import { adminMotionProfile } from "./motion-tokens";

function MotionStyles({ profile }: { profile: MotionProfile }) {
  const { reducedMotion } = useAdminMotion();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousMode = root.dataset.motion;
    const variables = motionCssVariables(
      profile,
      reducedMotion,
      "--admin-motion"
    );
    const previous = Object.keys(variables).map((name): [string, string] => [
      name,
      root.style.getPropertyValue(name),
    ]);
    for (const [name, value] of Object.entries(variables))
      root.style.setProperty(name, value);
    root.dataset.motion = reducedMotion ? "reduced" : "full";
    return () => {
      for (const [name, value] of previous) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
      if (previousMode) root.dataset.motion = previousMode;
      else delete root.dataset.motion;
    };
  }, [profile, reducedMotion]);
  return null;
}

export function MotionProvider({
  children,
  profile = adminMotionProfile,
}: {
  children: ReactNode;
  profile?: MotionProfile;
}) {
  return (
    <MotionProfileProvider profile={profile}>
      <MotionStyles profile={profile} />
      <AdminViewport />
      <TooltipProvider delayDuration={300} skipDelayDuration={400}>
        {children}
      </TooltipProvider>
    </MotionProfileProvider>
  );
}

export function useAdminMotion() {
  const context = useMotionProfile();
  if (!context) {
    throw new Error("useAdminMotion must be used within MotionProvider.");
  }
  return context;
}
