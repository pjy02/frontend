import { describe, expect, it } from "vitest";
import { getTablePagination, isSameTablePath } from "./use-table-search-params";

describe("table URL pagination", () => {
  it("treats index route trailing slashes as the same owner, without accepting other pages", () => {
    expect(isSameTablePath("/dashboard/user", "/dashboard/user/")).toBe(true);
    expect(isSameTablePath("/dashboard/user/", "/dashboard/user")).toBe(true);
    expect(isSameTablePath("/dashboard/order", "/dashboard/user/")).toBe(false);
  });
  it("restores supported page and page-size values from the URL", () => {
    expect(getTablePagination({ page: "4", size: "50" })).toEqual({
      page: 4,
      size: 50,
    });
  });

  it("falls back safely for invalid or unsupported values", () => {
    expect(getTablePagination({ page: "0", size: "5000" })).toEqual({
      page: 1,
      size: 10,
    });
    expect(getTablePagination({ page: "not-a-page", size: "20" })).toEqual({
      page: 1,
      size: 20,
    });
  });
});
