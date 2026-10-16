import { describe, expect, it } from "vitest";
import {
  parseTablePreferences,
  parseVisibility,
  safeViewFilters,
} from "./view-preferences";

describe("table view storage schema", () => {
  it("recovers from missing, invalid or null storage", () => {
    for (const raw of [null, "broken", "null", "[]"])
      expect(parseTablePreferences(raw)).toEqual({
        density: "comfortable",
        visibility: {},
        views: [],
      });
  });
  it("does not allow storage to hide structural columns or poison objects", () => {
    expect(
      parseVisibility(
        JSON.parse(
          '{"select":false,"actions":false,"sortable":false,"__proto__":false,"name":false,"id":"bad"}'
        )
      )
    ).toEqual({ name: false });
  });
  it("stores only finite scalar filter values, not credentials", () => {
    expect(
      safeViewFilters({
        user_id: 7,
        search: "example",
        enabled: false,
        password: "secret",
        token: "secret",
        nested: {},
        nan: Number.NaN,
      })
    ).toEqual({ user_id: 7, search: "example", enabled: false });
  });
  it("restores views and limits the stored payload", () => {
    const views = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      name: "Offline",
      density: "compact",
      filters: { online: false },
      visibility: { name: false },
    }));
    const value = parseTablePreferences(
      JSON.stringify({ density: "compact", views })
    );
    expect(value.density).toBe("compact");
    expect(value.views).toHaveLength(10);
    expect(value.views[0]?.filters).toEqual({ online: false });
  });
});
