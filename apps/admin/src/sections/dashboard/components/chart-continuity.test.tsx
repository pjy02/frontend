// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessTrends } from "./statistics";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/components/motion-provider", async () => {
  const { resolveMotion } = await import("@workspace/ui/lib/motion-profile");
  const { adminMotionProfile } = await import("@/components/motion-tokens");
  const full = resolveMotion(adminMotionProfile, false),
    reduced = resolveMotion(adminMotionProfile, true);
  return {
    useAdminMotion: () => ({
      reducedMotion: preference.reduced,
      presets: preference.reduced ? reduced : full,
    }),
  };
});
vi.mock("@workspace/ui/components/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => (
    <div data-chart>{children}</div>
  ),
  ChartLegend: ({ content }: { content: ReactNode }) => content,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));
vi.mock("recharts", () => {
  const chart = ({ children }: { children: ReactNode }) => (
    <div data-chart-canvas>
      {Children.toArray(children).filter(
        (child) => !isValidElement(child) || child.type !== "defs"
      )}
    </div>
  );
  const series = ({
    dataKey,
    animationDuration,
    isAnimationActive,
    hide,
    onAnimationEnd,
  }: any) => (
    <button
      aria-label={`Complete ${dataKey} draw`}
      data-active={isAnimationActive}
      data-duration={animationDuration}
      data-hidden={hide}
      data-series={dataKey}
      onClick={onAnimationEnd}
      type="button"
    />
  );
  return {
    AreaChart: chart,
    LineChart: chart,
    Area: series,
    Line: series,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
const revenue = {
  monthly: {
    amount_total: 400,
    list: [
      { date: "2026-10-16", new_order_amount: 300, renewal_order_amount: 100 },
    ],
  },
  all: {
    amount_total: 800,
    list: [
      { date: "2026-09-01", new_order_amount: 500, renewal_order_amount: 300 },
    ],
  },
} as API.RevenueStatisticsResponse;
const users = {
  monthly: {
    register: 4,
    list: [{ date: "2026-10-16", register: 4, new_order_users: 2 }],
  },
  all: {
    register: 8,
    list: [{ date: "2026-09-01", register: 8, new_order_users: 3 }],
  },
} as API.UserStatisticsResponse;
afterEach(() => {
  cleanup();
  preference.reduced = false;
});

describe("dashboard chart continuity", () => {
  it.each([
    "revenue",
    "users",
  ] as const)("keeps %s canvas, range and shared legend state when expanding and refreshing", (kind) => {
    const component = (
      range: "month" | "total",
      loading = false,
      error = false
    ) => (
      <BusinessTrends
        kind={kind}
        range={range}
        revenue={revenue}
        revenueError={error}
        revenueLoading={loading}
        users={users}
        usersError={error}
        usersLoading={loading}
      />
    );
    const view = render(component("month"));
    // The module grid appends freshness after this section. A 100% section
    // would consume its footer's space and place the timestamp in the next row.
    expect(
      view.container.querySelector("section")?.classList.contains("h-full")
    ).toBe(false);
    const key = kind === "revenue" ? "newPurchase" : "register";
    const label = kind === "revenue" ? "New purchase" : "Register";
    const canvas = view.container.querySelector("[data-chart-canvas]");
    const series = view.container.querySelector(`[data-series="${key}"]`);
    expect(series?.getAttribute("data-duration")).toBe("650");
    fireEvent.click(
      screen.getByRole("button", { name: `Complete ${key} draw` })
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(series?.getAttribute("data-hidden")).toBe("true");
    view.rerender(component("total"));
    expect(view.container.querySelector("[data-chart-canvas]")).toBe(canvas);
    expect(series?.getAttribute("data-duration")).toBe("220");
    expect(series?.getAttribute("data-hidden")).toBe("true");
    view.rerender(component("total", true, true));
    expect(view.container.querySelector("[data-chart-canvas]")).toBe(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Expand chart" }));
    const dialog = screen.getByRole("dialog");
    const expanded = dialog.querySelector(`[data-series="${key}"]`);
    expect(expanded?.getAttribute("data-hidden")).toBe("true");
    expect(expanded?.getAttribute("data-active")).toBe("false");
    const legend = dialog.querySelector(
      `[aria-pressed="false"]`
    ) as HTMLElement;
    fireEvent.click(legend);
    expect(series?.getAttribute("data-hidden")).toBe("false");
  });

  it("disables chart motion under reduced-motion without changing legend interactions", () => {
    preference.reduced = true;
    const view = render(
      <BusinessTrends
        kind="revenue"
        range="month"
        revenue={revenue}
        revenueError={false}
        revenueLoading={false}
        users={users}
        usersError={false}
        usersLoading={false}
      />
    );
    expect(
      view.container.querySelector("[data-series]")?.getAttribute("data-active")
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "New purchase" }));
    expect(
      screen
        .getByRole("button", { name: "New purchase" })
        .getAttribute("aria-pressed")
    ).toBe("false");
  });
});
