import { useLayoutEffect } from "react";

/** Dialog layout follows the visible viewport; Vaul still owns drawer gestures/keyboard. */
export function AdminViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const names = ["--admin-visible-height", "--admin-visible-top"];
    const previous = names.map((name) => root.style.getPropertyValue(name));
    let frame = 0;
    const update = () => {
      frame = 0;
      // Pinch zoom is browser-owned; do not resize a workspace around it.
      if (viewport.scale !== 1) {
        for (const name of names) root.style.removeProperty(name);
        return;
      }
      root.style.setProperty(names[0]!, `${viewport.height}px`);
      root.style.setProperty(names[1]!, `${viewport.offsetTop}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      names.forEach((name, index) => {
        if (previous[index]) root.style.setProperty(name, previous[index]);
        else root.style.removeProperty(name);
      });
    };
  }, []);
  return null;
}
