export type MotionEase = [number, number, number, number];

export type MotionRole =
  | "press"
  | "state"
  | "success"
  | "successHold"
  | "loading"
  | "menuEnter"
  | "menuExit"
  | "menuLevel"
  | "submenu"
  | "dialogEnter"
  | "dialogExit"
  | "overlayEnter"
  | "overlayExit"
  | "navigation"
  | "selection"
  | "expand"
  | "tab"
  | "dataEnter"
  | "dataExit"
  | "dataLayout"
  | "pagination"
  | "batch"
  | "feedback"
  | "progress"
  | "number"
  | "chart"
  | "tooltip"
  | "categoryEnter"
  | "categoryExit"
  | "categoryLayout"
  | "rankBar"
  | "tooltipBar"
  | "themeReveal"
  | "themeRevealCompact";

export interface MotionToken {
  /** Spatial changes must not compete with a drag/positioning owner. */
  kind: "spatial" | "state";
  /** Milliseconds in the source of truth; converted to seconds for Motion. */
  duration: number;
  ease: MotionEase;
  distance?: number;
  scale?: number;
  delay?: number;
}

export type MotionProfile = Record<MotionRole, MotionToken>;

export function resolveMotion(profile: MotionProfile, reducedMotion: boolean) {
  return Object.fromEntries(
    Object.entries(profile).map(([role, token]) => [
      role,
      {
        kind: token.kind,
        durationMs: reducedMotion ? 0 : token.duration,
        distance: reducedMotion ? 0 : (token.distance ?? 0),
        scale: reducedMotion ? 1 : (token.scale ?? 1),
        transition: {
          duration: reducedMotion ? 0 : token.duration / 1000,
          delay: reducedMotion ? 0 : (token.delay ?? 0) / 1000,
          ease: token.ease,
        },
      },
    ])
  ) as Record<
    MotionRole,
    {
      kind: MotionToken["kind"];
      durationMs: number;
      distance: number;
      scale: number;
      transition: { duration: number; delay: number; ease: MotionEase };
    }
  >;
}

export function motionCssVariables(
  profile: MotionProfile,
  reducedMotion: boolean,
  prefix: string
) {
  const resolved = resolveMotion(profile, reducedMotion);
  return Object.fromEntries(
    Object.entries(resolved).flatMap(([role, token]) => {
      const name = `${prefix}-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      return [
        [`${name}-duration`, `${token.durationMs}ms`],
        [`${name}-delay`, `${token.transition.delay * 1000}ms`],
        [`${name}-ease`, `cubic-bezier(${token.transition.ease.join(", ")})`],
        [`${name}-distance`, `${token.distance}px`],
        [`${name}-scale`, String(token.scale)],
      ];
    })
  );
}

export type ResolvedMotionProfile = ReturnType<typeof resolveMotion>;
