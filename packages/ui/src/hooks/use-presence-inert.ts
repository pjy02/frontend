import { type Ref, useCallback, useLayoutEffect, useState } from "react";
import { useMotionProfile } from "../components/motion-profile";

/** Presence retains closing content for paint, not for another click or Tab. */
export function usePresenceInert<T extends HTMLElement>(ref?: Ref<T>) {
  const enabled = Boolean(useMotionProfile());
  const [node, setNode] = useState<T | null>(null);
  const contentRef = useCallback(
    (element: T | null) => {
      setNode(element);
      if (typeof ref === "function") {
        const cleanup = ref(element);
        if (typeof cleanup === "function")
          return () => {
            setNode(null);
            cleanup();
          };
      } else if (ref) ref.current = element;
    },
    [ref]
  );
  useLayoutEffect(() => {
    if (!(node && enabled)) return;
    const update = () => {
      node.inert = node.dataset.state === "closed";
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(node, {
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => {
      observer.disconnect();
      node.inert = false;
    };
  }, [node, enabled]);
  // No additional ref/state updates in applications which have not opted in.
  return enabled ? contentRef : ref;
}
