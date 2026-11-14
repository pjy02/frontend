import { describe, expect, it } from "vitest";
import {
  inventorySearchTerm,
  matchesInventorySearch,
} from "./inventory-search";

describe("inventory search", () => {
  const server = { name: "HK-isvoro", address: "2001:db8::42" };
  const node = { ...server, port: 443, tags: ["premium", "Hong-Kong"] };

  it.each([
    "HK",
    "isvoro",
    " ISVORO ",
    "db8::42",
  ])("matches a literal fragment of a name or address: %s", (search) => {
    const term = inventorySearchTerm(search);
    expect(matchesInventorySearch(server, term)).toBe(true);
    expect(matchesInventorySearch(node, term)).toBe(true);
  });

  it("retains node tag lookup and exact numeric port matching", () => {
    expect(matchesInventorySearch(node, "kong")).toBe(true);
    expect(matchesInventorySearch(node, "443")).toBe(true);
    expect(matchesInventorySearch(node, "44")).toBe(false);
    expect(matchesInventorySearch(node, "%")).toBe(false);
  });
});
