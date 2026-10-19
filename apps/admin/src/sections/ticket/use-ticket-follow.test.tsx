// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTicketFollow } from "./use-ticket-follow";

function Conversation({ id = 1, count = 1, reduced = false }) {
  const follow = useTicketFollow(id, count, reduced);
  return (
    <div onScrollCapture={follow.onScrollCapture} ref={follow.scrollRef}>
      <div data-slot="scroll-area-viewport" data-testid="viewport" />
      {follow.hasNewMessages && (
        <button onClick={follow.jumpToLatest} type="button">
          New messages
        </button>
      )}
    </div>
  );
}
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function viewport() {
  const element = screen.getByTestId("viewport");
  Object.defineProperties(element, {
    scrollHeight: { value: 1000, configurable: true },
    clientHeight: { value: 200, configurable: true },
  });
  element.scrollTo = vi.fn();
  return element;
}
describe("ticket reading continuity", () => {
  it("follows near the bottom but exposes new messages without disturbing history", () => {
    const view = render(<Conversation />);
    const element = viewport();
    act(() => vi.advanceTimersByTime(32));
    expect(element.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: "instant",
    });
    vi.mocked(element.scrollTo).mockClear();
    element.scrollTop = 50;
    fireEvent.scroll(element);
    view.rerender(<Conversation count={2} />);
    act(() => vi.advanceTimersByTime(32));
    expect(element.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "New messages" }));
    expect(element.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: "smooth",
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("lets a late reader scroll cancel following and reduced motion jump instantly", () => {
    const view = render(<Conversation reduced />);
    const element = viewport();
    element.scrollTop = 0;
    fireEvent.scroll(element);
    act(() => vi.advanceTimersByTime(32));
    expect(element.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "New messages" }));
    expect(element.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: "instant",
    });
    vi.mocked(element.scrollTo).mockClear();
    view.rerender(<Conversation count={3} reduced />);
    view.unmount();
    act(() => vi.advanceTimersByTime(32));
    expect(element.scrollTo).not.toHaveBeenCalled();
  });
});
