import {
  useElementScrollRestoration,
  useLocation,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { isSameTablePath } from "@/utils/use-table-search-params";

const positions = new Map<string, { scrollX: number; scrollY: number }>();

/** Restore after account layout/data settle, not against a shorter skeleton. */
export function useDashboardScroll(ready: boolean, accountKey: string | null) {
  const router = useRouter();
  const owner = useMatch({ strict: false, select: (match) => match.pathname });
  const historyKey = useLocation({
    select: (location) => location.state.__TSR_key,
  });
  const saved = useElementScrollRestoration({ getElement: () => window });
  const key = accountKey && historyKey ? `${accountKey}:${historyKey}` : null;
  const entry = (key && positions.get(key)) || saved;
  const pending = useRef({ key, entry: entry ? { ...entry } : undefined });
  if (pending.current.key !== key)
    pending.current = { key, entry: entry ? { ...entry } : undefined };
  useEffect(() => {
    const remember = () => {
      if (
        !(key && ready) ||
        pending.current.entry ||
        !isSameTablePath(router.history.location.pathname, owner)
      )
        return;
      positions.delete(key);
      positions.set(key, { scrollX, scrollY });
      if (positions.size > 64) positions.delete(positions.keys().next().value!);
    };
    const cancel = () => {
      pending.current.entry = undefined;
    };
    const cancelKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancel();
    };
    window.addEventListener("scroll", remember, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("keydown", cancelKey);
    return () => {
      window.removeEventListener("scroll", remember);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", cancelKey);
    };
  }, [ready, key, router, owner]);
  useEffect(() => {
    if (!ready) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const target = pending.current.entry;
        pending.current.entry = undefined;
        if (target && isSameTablePath(router.history.location.pathname, owner))
          window.scrollTo({
            left: target.scrollX,
            top: target.scrollY,
            behavior: "instant",
          });
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready, key, router, owner]);
}
