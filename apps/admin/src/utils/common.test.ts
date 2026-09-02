// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  getRedirectUrl,
  normalizeAdminRedirectUrl,
  setRedirectUrl,
} from "./common";

describe("admin login redirects", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("accepts only internal dashboard destinations", () => {
    expect(normalizeAdminRedirectUrl("/dashboard")).toBe("/dashboard");
    expect(normalizeAdminRedirectUrl("/dashboard/log/order?user_id=7")).toBe(
      "/dashboard/log/order?user_id=7"
    );
    expect(
      normalizeAdminRedirectUrl("//example.com/dashboard")
    ).toBeUndefined();
    expect(normalizeAdminRedirectUrl("/login")).toBeUndefined();
  });

  it("restores and consumes the protected page saved before login", () => {
    setRedirectUrl("/dashboard/withdrawal?status=0");

    expect(getRedirectUrl()).toBe("/dashboard/withdrawal?status=0");
    expect(sessionStorage.getItem("redirect-url")).toBeNull();
    expect(getRedirectUrl()).toBe("/dashboard");
  });

  it("prefers a valid query redirect without retaining stale session state", () => {
    setRedirectUrl("/dashboard/order");
    window.history.replaceState(
      {},
      "",
      "/?redirect=%2Fdashboard%2Flog%2Forder%3Fuser_id%3D9"
    );

    expect(getRedirectUrl()).toBe("/dashboard/log/order?user_id=9");
    expect(sessionStorage.getItem("redirect-url")).toBeNull();
  });
});
