import { describe, expect, it } from "vitest";
import {
  getLogInitialFilters,
  localLogDate,
  validateLogRange,
  writeLogFilters,
} from "./log-filters";

const types = {
  user_id: "number",
  server_id: "number",
  subscribe_id: "number",
  user_subscribe_id: "number",
  search: "string",
} as const;
describe("unified log date ranges", () => {
  it("defaults new visits to today without losing IDs or text filters", () => {
    expect(
      getLogInitialFilters(
        {
          user_id: "7",
          server_id: 42,
          subscribe_id: "11",
          user_subscribe_id: "12",
          search: "order",
        },
        types,
        "2026-10-13"
      )
    ).toEqual({
      start_date: "2026-10-13",
      end_date: "2026-10-13",
      user_id: 7,
      server_id: 42,
      subscribe_id: 11,
      user_subscribe_id: 12,
      search: "order",
    });
  });
  it("converts old date links into a same-day range", () => {
    expect(getLogInitialFilters({ date: "2026-09-03" }, types)).toEqual({
      start_date: "2026-09-03",
      end_date: "2026-09-03",
    });
  });
  it.each([
    { start_date: "2026-09-01" },
    { end_date: "2026-09-30" },
  ])("preserves an open-ended range: %j", (range) => {
    expect(
      getLogInitialFilters({ ...range, date: "2025-01-01" }, types)
    ).toEqual(range);
    expect(validateLogRange(range)).toBeUndefined();
  });
  it("preserves explicitly cleared endpoints instead of silently reverting to today", () => {
    expect(
      getLogInitialFilters({ start_date: "", end_date: "" }, types)
    ).toEqual({});
  });
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-1-1",
    "yesterday",
  ])("rejects malformed dates: %s", (start_date) => {
    expect(validateLogRange({ start_date })).toBe("invalid");
  });
  it("accepts leap days, same-day ranges and rejects reversed ranges", () => {
    expect(
      validateLogRange({ start_date: "2024-02-29", end_date: "2024-02-29" })
    ).toBeUndefined();
    expect(
      validateLogRange({ start_date: "2026-10-13", end_date: "2026-10-12" })
    ).toBe("reversed");
  });
  it("uses browser calendar fields, not UTC date rollover", () => {
    const localMidnight = new Date(2026, 9, 13, 0, 1);
    expect(localLogDate(localMidnight)).toBe("2026-10-13");
  });
  it("canonicalizes dates while preserving pagination and unrelated investigation parameters", () => {
    const search = new URLSearchParams(
      "date=2026-09-03&page=4&size=50&server_id=42&subscribe_id=11&user_subscribe_id=12"
    );
    writeLogFilters(search, ["start_date", "end_date", "user_id"], {
      start_date: "2026-09-03",
      end_date: "2026-09-03",
      user_id: 7,
    });
    expect(Object.fromEntries(search)).toEqual({
      start_date: "2026-09-03",
      end_date: "2026-09-03",
      page: "4",
      size: "50",
      server_id: "42",
      subscribe_id: "11",
      user_subscribe_id: "12",
      user_id: "7",
    });
    expect(search.has("date")).toBe(false);
    writeLogFilters(search, ["start_date", "end_date", "user_id"], {
      end_date: "2026-10-13",
    });
    expect(search.get("start_date")).toBe("");
    expect(search.has("user_id")).toBe(false);
  });
});
