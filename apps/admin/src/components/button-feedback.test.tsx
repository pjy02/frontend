// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import { adminMotionProfile } from "./motion-tokens";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Admin button feedback policy", () => {
  it("lets a new operation interrupt a non-blocking successful refresh", () => {
    render(
      <MotionProvider>
        <Button success successLabel="Refreshed">
          Refresh
        </Button>
      </MotionProvider>
    );
    expect(
      (screen.getByRole("button", { name: "Refreshed" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it("locks immediately, keeps its content node and skips the spinner for a quick operation", () => {
    vi.useFakeTimers();
    const view = render(
      <MotionProvider>
        <Button>Save settings</Button>
      </MotionProvider>
    );
    const content = screen.getByText("Save settings");
    view.rerender(
      <MotionProvider>
        <Button loading loadingLabel="Saving">
          Save settings
        </Button>
      </MotionProvider>
    );
    expect(
      (screen.getByRole("button", { name: "Saving" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button").getAttribute("data-visual-status")).toBe(
      "idle"
    );
    act(() => vi.advanceTimersByTime(80));
    view.rerender(
      <MotionProvider>
        <Button>Save settings</Button>
      </MotionProvider>
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Save settings")).toBe(content);
    expect(document.querySelector("svg")).toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it("reveals a long-running spinner without holding the result for a full rotation", () => {
    vi.useFakeTimers();
    const view = render(
      <MotionProvider>
        <Button loading>Save</Button>
      </MotionProvider>
    );
    act(() =>
      vi.advanceTimersByTime(adminMotionProfile.loadingReveal.duration)
    );
    expect(screen.getByRole("button").getAttribute("data-visual-status")).toBe(
      "loading"
    );
    expect(document.querySelector("svg")).toBeTruthy();
    view.rerender(
      <MotionProvider>
        <Button>Save</Button>
      </MotionProvider>
    );
    expect(screen.getByRole("button").getAttribute("data-visual-status")).toBe(
      "idle"
    );
    expect(document.querySelector("svg")).toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it("closes an ordinary Admin confirmation on true success without a forced success hold", async () => {
    render(
      <MotionProvider>
        <ConfirmButton
          description="Fixture"
          onConfirm={async () => {
            await Promise.resolve();
          }}
          title="Save confirmation"
          trigger={<Button>Open</Button>}
        />
      </MotionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("does not interpret an explicit false result as success", async () => {
    render(
      <MotionProvider>
        <ConfirmButton
          description="Fixture"
          onConfirm={async () => false}
          title="Danger"
          trigger={<Button>Open</Button>}
        />
      </MotionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Completed")).toBeNull();
  });
});
