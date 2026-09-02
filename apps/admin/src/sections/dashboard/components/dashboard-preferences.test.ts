import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  parseDashboardPreferences,
} from "./dashboard-preferences";

describe("dashboard preferences", () => {
  it("keeps optional project support hidden by default", () => {
    expect(parseDashboardPreferences(null)).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES
    );
    expect(DEFAULT_DASHBOARD_PREFERENCES.projectSupport).toBe(false);
  });

  it("restores a valid project support preference", () => {
    expect(parseDashboardPreferences('{"projectSupport":true}')).toEqual({
      projectSupport: true,
    });
  });

  it("falls back safely for invalid or incomplete storage", () => {
    expect(parseDashboardPreferences("not-json")).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES
    );
    expect(parseDashboardPreferences("{}")).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES
    );
  });
});
