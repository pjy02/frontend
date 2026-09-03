import { describe, expect, it } from "vitest";
import { getTablePagination } from "./use-table-search-params";

describe("table URL pagination", () => {
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
