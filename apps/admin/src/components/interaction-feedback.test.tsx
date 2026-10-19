// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import { createRef } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import { adminMotionProfile } from "./motion-tokens";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

function ErrorMessageProbe() {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });

  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          onClick={() => form.setError("email", { message: "Email required" })}
          type="button"
        >
          Show error
        </button>
        <button onClick={() => form.clearErrors("email")} type="button">
          Clear error
        </button>
      </form>
    </Form>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("admin interaction feedback", () => {
  it("cancels the success timer on close so reopening cannot be closed by stale feedback", async () => {
    vi.useFakeTimers();
    render(
      <ConfirmButton
        description="Fixture"
        onConfirm={vi.fn()}
        title="Confirm operation"
        trigger={<Button>Open</Button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    );
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("retains input and allows confirmation retry after an actual rejected request", async () => {
    const confirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fixture"))
      .mockResolvedValueOnce(undefined);
    render(
      <ConfirmButton
        description="Fixture"
        onConfirm={confirm}
        title="Confirm operation"
        trigger={<Button>Open</Button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")
      ).toBe(false)
    );
    expect(screen.queryByText("Completed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Completed");
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("keeps button width content mounted while exposing loading and success", () => {
    const view = render(
      <Button loading loadingLabel="Refreshing data">
        Refresh
      </Button>
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Refreshing data",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText("Refresh")).toBeTruthy();

    view.rerender(
      <Button success successLabel="Data refreshed">
        Refresh
      </Button>
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Data refreshed",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("keeps the form message region mounted for enter and exit transitions", () => {
    render(<ErrorMessageProbe />);

    const region = document.querySelector('[data-slot="form-message-region"]');
    expect(region?.getAttribute("data-state")).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Show error" }));
    expect(screen.getByText("Email required")).toBeTruthy();
    expect(region?.getAttribute("data-state")).toBe("visible");

    fireEvent.click(screen.getByRole("button", { name: "Clear error" }));
    expect(region?.getAttribute("data-state")).toBe("hidden");
  });

  it("waits for destructive work and shows success before closing", async () => {
    vi.useFakeTimers();
    let resolveConfirm: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );

    render(
      <ConfirmButton
        description="This cannot be undone"
        onConfirm={onConfirm}
        title="Delete record"
        trigger={<Button>Delete</Button>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Processing")).toBeTruthy();

    await act(async () => resolveConfirm?.());
    expect(screen.getByText("Completed")).toBeTruthy();

    act(() => vi.advanceTimersByTime(420));
    expect(screen.queryByText("Delete record")).toBeNull();
  });

  it("restores focus to the action-menu trigger after cancelling", async () => {
    const returnFocusRef = createRef<HTMLButtonElement>();

    render(
      <>
        <Button ref={returnFocusRef}>More actions</Button>
        <ConfirmButton
          description="This cannot be undone"
          onConfirm={vi.fn()}
          restoreFocusRef={returnFocusRef}
          title="Delete record"
          trigger={
            <Button className="hidden" data-testid="confirm-trigger">
              Open confirm
            </Button>
          }
        />
      </>
    );

    fireEvent.click(screen.getByTestId("confirm-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(returnFocusRef.current)
    );
  });

  it("takes successful feedback retention from the opted-in profile", async () => {
    vi.useFakeTimers();
    const profile = {
      ...adminMotionProfile,
      successHold: { ...adminMotionProfile.successHold, duration: 60 },
    };
    render(
      <MotionProvider profile={profile}>
        <ConfirmButton
          description="Local fixture"
          onConfirm={async () => {
            await Promise.resolve();
          }}
          successFeedback="brief"
          title="Confirm operation"
          trigger={<Button>Open</Button>}
        />
      </MotionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    );
    expect(screen.getByText("Completed")).toBeTruthy();
    act(() => vi.advanceTimersByTime(59));
    expect(screen.getByText("Confirm operation")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Confirm operation")).toBeNull();
  });

  it("does not schedule feedback after the pending confirmation unmounts", async () => {
    vi.useFakeTimers();
    let resolve: (() => void) | undefined;
    const view = render(
      <ConfirmButton
        description="Local fixture"
        onConfirm={() =>
          new Promise<void>((done) => {
            resolve = done;
          })
        }
        title="Confirm operation"
        trigger={<Button>Open</Button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    view.unmount();
    const schedule = vi.spyOn(globalThis, "setTimeout");
    await act(async () => resolve?.());
    expect(schedule.mock.calls.some((args) => args[1] === 420)).toBe(false);
  });
});
