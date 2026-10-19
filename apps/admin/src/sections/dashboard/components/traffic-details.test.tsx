// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrafficRankingRow } from "./statistics";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => values?.[key] || key),
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/components/motion-provider", async () => {
  const { resolveMotion } = await import("@workspace/ui/lib/motion-profile");
  const { adminMotionProfile } = await import("@/components/motion-tokens");
  const presets = resolveMotion(adminMotionProfile, true);
  return { useAdminMotion: () => ({ reducedMotion: true, presets }) };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search, children, ...props }: any) => (
    <a href={`${to}?${new URLSearchParams(search)}`} {...props}>
      {children}
    </a>
  ),
}));
const item = {
  id: 4,
  name: "Node 4",
  uid: 7,
  sid: 4,
  upload: 100,
  download: 200,
  total: 300,
  previousUpload: 50,
  previousDownload: 100,
  previousTotal: 150,
  absoluteChange: 150,
  growth: 100,
  comparison: "comparable" as const,
  share: 25,
  rankChange: 1,
  isNew: false,
};
function media(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: mobile && /max-width|pointer: coarse/.test(query),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
  );
  vi.stubGlobal("innerWidth", mobile ? 390 : 1440);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("touch traffic details", () => {
  it("keeps an open detail and its comparison bars when email and period data update", async () => {
    media(true);
    const row = (email?: string, total = 300) => (
      <TooltipProvider>
        <ol>
          <TrafficRankingRow
            currentLabel="Today"
            index={0}
            item={{ ...item, total }}
            leaderTotal={total}
            previousLabel="Yesterday"
            reducedMotion
            selectedDate="2026-10-15"
            trafficType="users"
            userEmail={email}
            userEmailLoading={!email}
          />
        </ol>
      </TooltipProvider>
    );
    const view = render(row());
    fireEvent.click(
      screen.getByRole("button", { name: "Traffic details for Node 4" })
    );
    const dialog = await screen.findByRole("dialog");
    const detail = dialog.querySelector("[data-tooltip-key]");
    const bar = dialog.querySelector(".dashboard-traffic-tooltip-bar");
    view.rerender(row("new@example.com", 600));
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(dialog.querySelector("[data-tooltip-key]")).toBe(detail);
    expect(dialog.querySelector(".dashboard-traffic-tooltip-bar")).toBe(bar);
    expect(dialog.textContent).toContain("new@example.com");
    expect(dialog.textContent).toContain("UID 7");
    expect(dialog.querySelectorAll("[data-tooltip-key]")).toHaveLength(1);
  });
  it.each([
    "nodes",
    "users",
  ] as const)("opens complete %s details with the correct log filters and restores focus", async (trafficType) => {
    media(true);
    render(
      <TooltipProvider>
        <ol>
          <TrafficRankingRow
            currentLabel="Today"
            index={0}
            item={item}
            leaderTotal={300}
            previousLabel="Yesterday"
            reducedMotion
            selectedDate="2026-10-15"
            trafficType={trafficType}
            userEmail={trafficType === "users" ? "user@example.com" : undefined}
            userEmailLoading={false}
          />
        </ol>
      </TooltipProvider>
    );
    const trigger = screen.getByRole("button", {
      name: `Traffic details for ${trafficType === "users" ? "user@example.com" : "Node 4"}`,
    });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("UID 7");
    expect(dialog.textContent).toContain("SID 4");
    expect(dialog.textContent).toContain("Share of returned ranking");
    expect(dialog.textContent).toContain("Absolute change");
    const link = screen.getByRole("link", { name: "Traffic logs" });
    expect(link.getAttribute("href")).toContain(
      trafficType === "nodes" ? "server_id=4" : "user_subscribe_id=4"
    );
    expect(link.getAttribute("href")).toContain("date=2026-10-15");
    if (trafficType === "users")
      expect(link.getAttribute("href")).toContain("user_id=7");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it("retains hover-only behavior for a desktop pointer", () => {
    media(false);
    render(
      <TooltipProvider>
        <ol>
          <TrafficRankingRow
            currentLabel="Today"
            index={0}
            item={{
              ...item,
              comparison: "missing",
              growth: null,
              isNew: true,
              rankChange: undefined,
            }}
            leaderTotal={300}
            previousLabel="Yesterday"
            reducedMotion
            selectedDate="2026-10-15"
            trafficType="nodes"
            userEmailLoading={false}
          />
        </ol>
      </TooltipProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Traffic details for Node 4" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Cannot compare")).toBeTruthy();
    expect(screen.queryByText("New")).toBeNull();
  });
});
