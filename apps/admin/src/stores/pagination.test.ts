import { describe, expect, it, vi } from "vitest";
import { fetchAllPaginated } from "./pagination";

describe("fetchAllPaginated", () => {
  it("loads and preserves an IPv6 server beyond a capped first page", async () => {
    const servers = [
      { id: 1, address: "192.0.2.1" },
      { id: 2, address: "2001:db8::2" },
    ];
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      data: { data: { list: servers.slice(page - 1, page), total: 2 } },
    }));
    const signal = new AbortController().signal;

    await expect(fetchAllPaginated(fetchPage, signal)).resolves.toEqual(
      servers
    );
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      { page: 2, size: 100 },
      { signal }
    );
  });

  it("stops after a superseded first page", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(async () => {
      controller.abort();
      return { data: { data: { list: [{ id: 1 }], total: 2 } } };
    });

    await expect(
      fetchAllPaginated(fetchPage, controller.signal)
    ).rejects.toHaveProperty("name", "AbortError");
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
