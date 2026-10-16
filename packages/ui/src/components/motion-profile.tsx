"use client";

import { MotionConfig } from "motion/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useReducedMotion } from "../hooks/use-reduced-motion";
import { type MotionProfile, resolveMotion } from "../lib/motion-profile";

type MotionSettings = {
  reducedMotion: boolean;
  presets: ReturnType<typeof resolveMotion>;
};

const MotionProfileContext = createContext<MotionSettings | null>(null);

/** Opt-in only. No root styles or default profile are installed for User Web. */
export function MotionProfileProvider({
  profile,
  children,
}: {
  profile: MotionProfile;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const value = useMemo(
    () => ({ reducedMotion, presets: resolveMotion(profile, reducedMotion) }),
    [profile, reducedMotion]
  );
  return (
    <MotionProfileContext.Provider value={value}>
      <MotionConfig
        reducedMotion={reducedMotion ? "always" : "never"}
        transition={value.presets.dataEnter.transition}
      >
        {children}
      </MotionConfig>
    </MotionProfileContext.Provider>
  );
}

/** null preserves existing shared-component behavior outside an opted-in app. */
export function useMotionProfile() {
  return useContext(MotionProfileContext);
}
