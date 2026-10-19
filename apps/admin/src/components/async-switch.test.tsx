// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncSwitch } from "./async-switch";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
afterEach(cleanup);

function mount(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("truthful controlled row switches", () => {
  it("keeps mobile feedback compact while exposing complete guidance and read-only retry", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const sync = vi.fn().mockRejectedValue(new Error("read unavailable"));
    mount(
      <AsyncSwitch
        checked={false}
        compact
        field="show"
        id={3}
        label="Visible"
        onSync={sync}
        onWrite={write}
        resource="product"
      />
    );
    fireEvent.click(screen.getByRole("switch"));
    await screen.findByText("Saved · stale");
    expect(screen.getByRole("alert").textContent).not.toContain(
      "do not submit again"
    );
    const details = screen.getByRole("button", {
      name: "Saved. Refresh failed; do not submit again.",
    });
    fireEvent.click(details);
    expect(
      await screen.findByText("Saved. Refresh failed; do not submit again.")
    ).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("retains both switch and status on a rejected write and permits a safe retry", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const sync = vi.fn().mockResolvedValue(undefined);
    mount(
      <AsyncSwitch
        checked={false}
        field="show"
        id={1}
        label="Visible"
        onSync={sync}
        onWrite={write}
        resource="product"
        status={(value) => <span>{value ? "Shown" : "Hidden"}</span>}
      />
    );
    fireEvent.click(screen.getByRole("switch"));
    await screen.findByRole("alert");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "false"
    );
    expect(screen.getByText("Hidden")).toBeTruthy();
    expect(sync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shares the row lock across duplicate views and different fields, not other records", async () => {
    let finish: (() => void) | undefined;
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const sync = vi.fn().mockResolvedValue(undefined);
    mount(
      <>
        <AsyncSwitch
          checked={false}
          field="show"
          id={1}
          label="Desktop"
          onSync={sync}
          onWrite={write}
          resource="product"
        />
        <AsyncSwitch
          checked={false}
          field="show"
          id={1}
          label="Mobile"
          onSync={sync}
          onWrite={write}
          resource="product"
        />
        <AsyncSwitch
          checked
          field="sell"
          id={1}
          label="Sell"
          onSync={sync}
          onWrite={write}
          resource="product"
        />
        <AsyncSwitch
          checked
          field="show"
          id={2}
          label="Other record"
          onSync={sync}
          onWrite={write}
          resource="product"
        />
      </>
    );
    act(() => {
      fireEvent.click(screen.getByRole("switch", { name: "Desktop" }));
      fireEvent.click(screen.getByRole("switch", { name: "Mobile" }));
      fireEvent.click(screen.getByRole("switch", { name: "Sell" }));
    });
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("switch", { name: "Mobile" }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    );
    expect(
      (screen.getByRole("switch", { name: "Sell" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("switch", {
          name: "Other record",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    await act(async () => finish?.());
    await waitFor(() =>
      expect(
        (screen.getByRole("switch", { name: "Sell" }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
  });

  it("retains a confirmed write when sync fails and retries only the read", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    let finishRetry: (() => void) | undefined;
    const sync = vi
      .fn()
      .mockRejectedValueOnce(new Error("read failed"))
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishRetry = resolve;
          })
      );
    function Probe() {
      const [checked, setChecked] = useState(false);
      return (
        <AsyncSwitch
          checked={checked}
          field="enable"
          id={1}
          label="Enable"
          onSync={async () => {
            await sync();
            setChecked(true);
          }}
          onWrite={write}
          resource="user"
          status={(value) => <span>{value ? "Enabled" : "Disabled"}</span>}
        />
      );
    }
    mount(<Probe />);
    fireEvent.click(screen.getByRole("switch"));
    await screen.findByRole("alert");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(screen.getByText("Enabled")).toBeTruthy();
    await act(async () => finishRetry?.());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(write).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("keeps a failed read retry from ever repeating the write", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const sync = vi.fn().mockRejectedValue(new Error("read unavailable"));
    mount(
      <AsyncSwitch
        checked={false}
        field="show"
        id={1}
        label="Visible"
        onSync={sync}
        onWrite={write}
        resource="document"
      />
    );
    fireEvent.click(screen.getByRole("switch"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Retry refresh",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true"
    );
  });
});
