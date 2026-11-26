import type {
  MotionEase,
  MotionProfile,
  MotionToken,
} from "@workspace/ui/lib/motion-profile";

const standard: MotionEase = [0.2, 0, 0, 1];
const enter: MotionEase = [0.16, 1, 0.3, 1];
const exit: MotionEase = [0.4, 0, 1, 1];
const emphasized: MotionEase = [0.22, 1, 0.36, 1];
// Recharts' public type only accepts named curves; keep its bridge centralized.
export const adminChartEasing = "ease-out" as const;
const state = (duration: number, ease = standard): MotionToken => ({
  kind: "state",
  duration,
  ease,
});
const spatial = (
  duration: number,
  distance = 0,
  scale = 1,
  ease = standard
): MotionToken => ({ kind: "spatial", duration, distance, scale, ease });

/** Single source for Admin CSS variables and Motion transitions. Durations: ms. */
export const adminMotionProfile: MotionProfile = {
  press: spatial(75, 0, 0.98),
  state: state(110),
  success: spatial(280, 0, 0.72, enter),
  // Retention after a successful request, not time allocated to the request.
  successHold: state(180),
  loading: state(720),
  loadingReveal: state(120),
  menuEnter: spatial(160, 4, 0.985, enter),
  menuExit: spatial(100, 2, 0.99, exit),
  menuLevel: spatial(170, 18, 1, emphasized),
  submenu: spatial(150, 6, 0.985, enter),
  dialogEnter: spatial(220, 6, 0.985, enter),
  dialogExit: spatial(150, 4, 0.99, exit),
  overlayEnter: state(160, enter),
  overlayExit: state(110, exit),
  navigation: spatial(200, 4, 1, enter),
  selection: spatial(200, 0, 1, emphasized),
  expand: spatial(240, 3, 1, emphasized),
  tab: spatial(180, 4, 1, enter),
  dataEnter: spatial(180, 3, 0.99),
  dataExit: spatial(120, 3, 0.99, exit),
  dataLayout: spatial(220, 0, 1, emphasized),
  pagination: spatial(160, 6),
  batch: spatial(180, 8),
  feedback: state(900, enter),
  progress: state(1150),
  number: state(580, enter),
  chart: spatial(650),
  tooltip: spatial(100, 2),
  categoryEnter: { ...spatial(180, 0, 0.985), delay: 60 },
  categoryExit: spatial(90, 0, 0.985, exit),
  categoryLayout: spatial(240),
  rankBar: spatial(280, 0, 0.78, enter),
  tooltipBar: spatial(360, 0, 0, enter),
  themeReveal: spatial(420),
  themeRevealCompact: spatial(360),
};
