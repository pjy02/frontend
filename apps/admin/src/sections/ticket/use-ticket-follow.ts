import { type UIEvent, useEffect, useRef, useState } from "react";

/** Incoming messages never pull a reader away from history. */
export function useTicketFollow(
  ticketId: unknown,
  count: number,
  reducedMotion: boolean
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const previous = useRef({ id: ticketId, count: 0 });
  const viewport = () =>
    scrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
  const jumpToLatest = () => {
    viewport()?.scrollTo({
      top: viewport()?.scrollHeight,
      behavior: reducedMotion ? "instant" : "smooth",
    });
    nearBottom.current = true;
    setHasNewMessages(false);
  };
  const onScrollCapture = (event: UIEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    if (!element.matches('[data-slot="scroll-area-viewport"]')) return;
    nearBottom.current =
      element.scrollHeight - element.clientHeight - element.scrollTop < 80;
    if (nearBottom.current) setHasNewMessages(false);
  };
  useEffect(() => {
    if (previous.current.id !== ticketId) {
      nearBottom.current = true;
      previous.current = { id: ticketId, count: 0 };
      setHasNewMessages(false);
    }
    const added = count > previous.current.count;
    previous.current.count = count;
    if (!nearBottom.current) {
      if (added) setHasNewMessages(true);
      return;
    }
    const frame = requestAnimationFrame(() => {
      // User input between commit and this frame wins over deferred following.
      if (!nearBottom.current) {
        if (added) setHasNewMessages(true);
        return;
      }
      const element = scrollRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );
      element?.scrollTo({ top: element.scrollHeight, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [ticketId, count]);
  return { scrollRef, hasNewMessages, jumpToLatest, onScrollCapture };
}
