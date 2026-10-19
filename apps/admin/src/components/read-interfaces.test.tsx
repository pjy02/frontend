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
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleForm from "@/sections/auth-control/forms/google-form";
import SystemLogsDialog from "@/sections/dashboard/components/system-logs-dialog";
import DynamicMultiplier from "@/sections/servers/dynamic-multiplier";

const api = vi.hoisted(() => ({
  config: vi.fn(),
  save: vi.fn(),
  logs: vi.fn(),
  multiplier: vi.fn(),
  saveMultiplier: vi.fn(),
}));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  getAuthMethodConfig: api.config,
  putAuthMethodConfig: api.save,
  getToolLog: api.logs,
  getSystemGetNodeMultiplier: api.multiplier,
  postSystemSetNodeMultiplier: api.saveMultiplier,
}));
vi.mock("@workspace/ui/composed/icon", () => ({ Icon: () => null }));
vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
const clients: QueryClient[] = [];
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllGlobals();
});

describe("real configuration and log reads", () => {
  it("protects multiplier drafts during refresh and clears fields on a verified empty configuration", async () => {
    const periods = (multiplier: number) => ({
      data: {
        data: {
          periods: [
            { start_time: "01:00:00", end_time: "02:00:00", multiplier },
          ],
        },
      },
    });
    api.multiplier
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(periods(2))
      .mockResolvedValueOnce(periods(4))
      .mockResolvedValueOnce({ data: { data: { periods: [] } } });
    const client = mount(<DynamicMultiplier />);
    fireEvent.click(screen.getByRole("button", { name: "Dynamic multiplier" }));
    await screen.findByRole("heading", { name: "Unable to load data" });
    expect(
      (
        screen.getByRole("button", {
          name: "Save",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const field = (await screen.findByRole("spinbutton")) as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe("2"));
    fireEvent.change(field, { target: { value: "3" } });
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["getNodeMultiplier"] });
    });
    expect(field.value).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(field.value).toBe("4"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["getNodeMultiplier"] });
    });
    await waitFor(() =>
      expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
        ""
      )
    );
    expect(api.saveMultiplier).not.toHaveBeenCalled();
  });
  it("blocks blank Google defaults after failure and preserves edits when a later refresh fails", async () => {
    api.config
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 7,
            enabled: false,
            method: "google",
            config: {
              client_id: "saved-client",
              client_secret: "saved-secret",
            },
          },
        },
      });
    const client = mount(<GoogleForm />);
    const trigger = screen.getByRole("button", { name: /Google Sign-In/ });
    fireEvent.click(trigger);
    await screen.findByRole("heading", { name: "Unable to load data" });
    expect(screen.queryByLabelText("Client ID")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(api.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const input = (await screen.findByDisplayValue(
      "saved-client"
    )) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "unsaved-client" } });
    api.config.mockRejectedValue(new Error("refresh failed"));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["getAuthMethodConfig", "google"],
      });
    });
    await screen.findByText(/Showing previously loaded data/);
    expect(screen.getByDisplayValue("unsaved-client")).toBe(input);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("gives system logs independent error, empty, refreshing and stale states", async () => {
    api.logs
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { data: { list: [] } } })
      .mockResolvedValueOnce({
        data: {
          data: { list: [{ timestamp: "log-2026", message: "Retained log" }] },
        },
      });
    mount(<SystemLogsDialog />);
    fireEvent.click(screen.getByRole("button", { name: "System Logs" }));
    await screen.findByRole("heading", { name: "Unable to load data" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: "No data available" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Logs" }));
    const row = await screen.findByRole("button", { name: "log-2026" });
    api.logs.mockRejectedValue(new Error("refresh failed"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Logs" }));
    await screen.findByText(/Showing previously loaded data/);
    expect(screen.getByRole("button", { name: "log-2026" })).toBe(row);
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh Logs",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    await waitFor(() => expect(api.logs).toHaveBeenCalledTimes(4));
  });
});
