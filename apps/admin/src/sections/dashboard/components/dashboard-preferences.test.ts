import { describe, expect, it } from "vitest";
import {
  DASHBOARD_MODULES,
  DEFAULT_DASHBOARD_PREFERENCES,
  dashboardPreset,
  moveDashboardModule,
  parseDashboardPreferences,
} from "./dashboard-preferences";

describe("dashboard preferences", () => {
  it("preserves the original order and hides support by default", () => {
    const value = parseDashboardPreferences(null);
    expect(value).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
    expect(value.desktop.order).toEqual(DASHBOARD_MODULES);
    expect(value.desktop.hidden).toEqual(["projectSupport"]);
  });
  it("keeps mobile and desktop independent", () => {
    const desktop = dashboardPreset("infrastructure"),
      mobile = dashboardPreset("minimal");
    expect(
      parseDashboardPreferences(JSON.stringify({ desktop, mobile }))
    ).toEqual({ desktop, mobile });
    expect(desktop.order[0]).toBe("onlineUsers");
    expect(mobile.hidden).toContain("revenueTrend");
  });
  it("rejects corrupt storage and does not reuse an unscoped legacy account preference", () => {
    for (const raw of ["not-json", "null", "{}", '{"projectSupport":true}'])
      expect(parseDashboardPreferences(raw)).toEqual(
        DEFAULT_DASHBOARD_PREFERENCES
      );
  });
  it("normalizes unknown and duplicate module IDs and retains newly added modules", () => {
    const value = parseDashboardPreferences(
      '{"desktop":{"order":["servers","unknown","servers"],"hidden":["unknown","income","income"]}}'
    );
    expect(value.desktop.order[0]).toBe("servers");
    expect(new Set(value.desktop.order).size).toBe(DASHBOARD_MODULES.length);
    expect(value.desktop.hidden).toEqual(["income"]);
  });
  it("moves exactly one module without mutating other layouts", () => {
    const initial = dashboardPreset("default");
    const moved = moveDashboardModule(initial, "trafficRanking", -1);
    expect(moved.order.indexOf("trafficRanking")).toBe(3);
    expect(initial.order.indexOf("trafficRanking")).toBe(4);
    expect(moveDashboardModule(initial, "income", -1)).toBe(initial);
  });
  it("has complete deduplicated module sets in all presets and permits hiding everything", () => {
    for (const preset of [
      "default",
      "operations",
      "infrastructure",
      "minimal",
    ] as const) {
      expect(new Set(dashboardPreset(preset).order).size).toBe(
        DASHBOARD_MODULES.length
      );
      expect(dashboardPreset(preset).hidden).toContain("projectSupport");
    }
    expect(
      parseDashboardPreferences(
        JSON.stringify({
          desktop: { order: DASHBOARD_MODULES, hidden: DASHBOARD_MODULES },
        })
      ).desktop.hidden
    ).toHaveLength(DASHBOARD_MODULES.length);
  });
});
