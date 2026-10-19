import { useRef } from "react";
import { useMotionProfile } from "../components/motion-profile";

let handoff: HTMLElement | null = null;
let handoffTimer: ReturnType<typeof setTimeout> | undefined;

/** Transient focus ownership only; never stores/replays business events. */
export function handoffOverlayFocus(target: HTMLElement | null) {
  clearTimeout(handoffTimer);
  handoff = target;
  handoffTimer = setTimeout(() => {
    handoff = null;
  }, 0);
}

/** Admin opt-in. Radix still owns the focus trap and normal trigger restoration. */
export function useOverlayFocus() {
  const profile = useMotionProfile();
  const origin = useRef<HTMLElement | null>(null);
  const neighbor = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLElement | null>(null);
  return {
    remember: () => {
      if (!profile) return;
      let target = handoff ?? (document.activeElement as HTMLElement | null);
      handoff = null;
      clearTimeout(handoffTimer);
      // Dialogs launched by a menu restore to its root trigger, not an exiting item.
      let menu = target?.closest('[role="menu"]');
      while (menu) {
        const id = menu.getAttribute("aria-labelledby");
        const trigger = id ? document.getElementById(id) : null;
        if (!trigger || trigger === target) break;
        target = trigger;
        menu = trigger.closest('[role="menu"]');
      }
      origin.current = target;
      const row = target?.closest("tr, .admin-pro-table-card");
      neighbor.current = (row?.nextElementSibling ??
        row?.previousElementSibling) as HTMLElement | null;
      list.current =
        target?.closest<HTMLElement>(
          '.admin-pro-table, [data-slot="sidebar"]'
        ) ?? null;
    },
    restore: (event: Event) => {
      if (!profile || event.defaultPrevented) return;
      const target = origin.current;
      if (
        Array.from(
          document.querySelectorAll(
            '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"]'
          )
        ).some(
          (element) =>
            element !== event.target && !(target && element.contains(target))
        )
      ) {
        event.preventDefault();
        return;
      }
      if (
        target?.isConnected &&
        target !== document.body &&
        !target.closest(
          '[inert], [hidden], [role="menu"][data-state="closed"], [role="dialog"][data-state="closed"]'
        ) &&
        !target.matches(":disabled")
      ) {
        event.preventDefault();
        target.focus({ preventScroll: true });
        if (document.activeElement === target) return;
      }
      const fallback = neighbor.current?.isConnected
        ? neighbor.current.querySelector<HTMLElement>(
            "button:not(:disabled), a[href]"
          )
        : null;
      const destination =
        fallback ?? (list.current?.isConnected ? list.current : null);
      if (!destination) return;
      event.preventDefault();
      if (
        !(
          destination.hasAttribute("tabindex") ||
          destination.matches("button, a[href]")
        )
      ) {
        destination.setAttribute("tabindex", "-1");
        destination.addEventListener(
          "blur",
          () => destination.removeAttribute("tabindex"),
          { once: true }
        );
      }
      destination.focus({ preventScroll: true });
    },
  };
}
