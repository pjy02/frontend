// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogCleanupForm from "./log-cleanup-form";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refetch: vi.fn() }));
const legacy = { auto_clear: false, clear_days: 3 };
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: legacy, refetch: mocks.refetch }),
}));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  getLogSetting: vi.fn(),
  postLogSetting: mocks.update,
}));
vi.mock("@workspace/ui/composed/icon", () => ({ Icon: () => null }));
vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      fallback: string,
      params?: Record<string, string | number>
    ) =>
      Object.entries(params || {}).reduce(
        (value, [key, text]) => value.replaceAll(`{{${key}}}`, String(text)),
        fallback
      ),
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  mocks.update.mockReset().mockResolvedValue({ data: { code: 200 } });
  mocks.refetch.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("legacy log retention", () => {
  it("shows the saved three-day value and requires an explicit correction before saving", async () => {
    render(<LogCleanupForm />);
    fireEvent.click(screen.getByText("Log Cleanup Settings", { exact: true }));
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("3");
    expect(input.disabled).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain(
      "saved retention is 3 days"
    );
    fireEvent.submit(input.form!);
    await screen.findByText("Keep logs for at least 7 whole days.");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(input.value).toBe("3");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm save" })
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        auto_clear: false,
        clear_days: 7,
      })
    );
  });
});
