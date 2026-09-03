import { describe, expect, it } from "vitest";
import { LIVE_QUERY_OPTIONS, TanStackQueryContext } from "./tanstack-query";

describe("TanStack Query cache policy", () => {
  it("caches ordinary configuration queries briefly", () => {
    const { queryClient } = TanStackQueryContext();

    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("provides an explicit real-time policy for dashboards and live views", () => {
    expect(LIVE_QUERY_OPTIONS).toEqual({
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      staleTime: 0,
    });
  });
});
