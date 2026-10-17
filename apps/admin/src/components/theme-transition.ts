import type { Theme } from "@workspace/ui/integrations/theme";

export function themeRevealGeometry(
  rect: DOMRect,
  width: number,
  height: number
) {
  const x = Math.max(0, Math.min(width, rect.left + rect.width / 2));
  const y = Math.max(0, Math.min(height, rect.top + rect.height / 2));
  return {
    x,
    y,
    radius:
      Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y))) +
      2,
  };
}

interface RevealSettings {
  reduced: boolean;
  duration: number;
  easing: string;
}

interface RevealSession {
  cancelled: boolean;
  trigger: HTMLElement;
  transition?: ViewTransition;
  animation?: Animation;
}

/** Serialize only DOM commits, never queue obsolete visual animations. */
export function createThemeTransition(
  commit: (theme: Theme) => void,
  settings: () => RevealSettings
) {
  const root = document.documentElement;
  let version = 0;
  let disposed = false;
  let queue = Promise.resolve();
  let active: RevealSession | undefined;

  const clean = (session: RevealSession) => {
    session.animation?.cancel();
    if (active !== session) return;
    active = undefined;
    delete root.dataset.themeReveal;
    delete root.dataset.themeCapture;
  };
  const cancelVisual = () => {
    if (!active) return;
    active.cancelled = true;
    active.animation?.cancel();
    active.transition?.skipTransition();
  };

  const change = (next: Theme, trigger: HTMLElement | null) => {
    const ticket = ++version;
    cancelVisual();
    const rect = trigger?.isConnected
      ? trigger.getBoundingClientRect()
      : undefined;
    const geometry = rect
      ? themeRevealGeometry(rect, innerWidth, innerHeight)
      : undefined;
    queue = queue
      .catch(() => {
        /* A failed prior commit must not block a later choice. */
      })
      .then(async () => {
        if (disposed || ticket !== version) return;
        const resolved =
          next === "system"
            ? matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
            : next;
        const current = root.classList.contains("dark") ? "dark" : "light";
        const motion = settings();
        if (
          current === resolved ||
          motion.reduced ||
          document.hidden ||
          !geometry ||
          !rect?.width ||
          !rect.height ||
          (window.visualViewport && window.visualViewport.scale !== 1) ||
          typeof document.startViewTransition !== "function" ||
          typeof root.animate !== "function" ||
          !CSS.supports("clip-path", "circle(1px at 1px 1px)")
        ) {
          commit(next);
          return;
        }

        // A missing/detached trigger takes the direct-update branch above.
        if (!trigger) return;
        const session: RevealSession = { cancelled: false, trigger };
        active = session;
        root.dataset.themeReveal = "true";
        // Suppress competing color transitions only while snapshots are captured.
        root.dataset.themeCapture = "true";
        let committed = false;
        try {
          session.transition = document.startViewTransition(() => {
            if (disposed || ticket !== version) return;
            commit(next);
            committed = true;
          });
        } catch {
          clean(session);
          if (!disposed && ticket === version && !committed) commit(next);
          return;
        }
        const transition = session.transition;
        const animate = async () => {
          await transition.ready;
          if (active === session) delete root.dataset.themeCapture;
          if (
            session.cancelled ||
            disposed ||
            ticket !== version ||
            settings().reduced
          ) {
            transition.skipTransition();
            return;
          }
          const center = `${geometry.x}px ${geometry.y}px`;
          session.animation = root.animate(
            [
              { clipPath: `circle(0px at ${center})` },
              { clipPath: `circle(${geometry.radius}px at ${center})` },
            ],
            {
              duration: motion.duration,
              easing: motion.easing,
              fill: "both",
              pseudoElement: "::view-transition-new(root)",
            }
          );
          await session.animation.finished;
        };
        // ready rejects when a transition is skipped. Always settle and clean up.
        animate().catch(() => transition.skipTransition());
        transition.finished
          .catch(() => {
            /* Skipping is a normal cancellation. */
          })
          .finally(() => clean(session));
        try {
          await transition.updateCallbackDone;
        } catch {
          transition.skipTransition();
          if (!disposed && ticket === version && !committed) commit(next);
        }
      });
    return queue;
  };
  return {
    change,
    cancelVisual,
    interruptPointer: (event: PointerEvent) => {
      // Native root snapshots suppress hit testing of their captured contents.
      // Only forward the theme trigger, never arbitrary business actions.
      if (
        !active ||
        active.cancelled ||
        event.target !== root ||
        !event.isPrimary ||
        event.button !== 0 ||
        event.ctrlKey
      )
        return;
      const trigger = active.trigger;
      if (!trigger.isConnected) return;
      const rect = trigger.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return;
      cancelVisual();
      return trigger;
    },
    dispose: () => {
      disposed = true;
      version++;
      const session = active;
      cancelVisual();
      if (session) clean(session);
    },
  };
}
