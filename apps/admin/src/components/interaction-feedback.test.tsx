// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});

describe("admin interaction feedback", () => {
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
});
