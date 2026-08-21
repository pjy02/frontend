import { describe, expect, it } from "vitest";
import { findNavByUrl, type NavItem } from "./navs";

const navs: NavItem[] = [
  {
    title: "Infrastructure",
    items: [
      {
        title: "Servers",
        url: "/dashboard/servers",
      },
    ],
  },
];

describe("findNavByUrl", () => {
  it("keeps the parent navigation active for nested editor routes", () => {
    expect(findNavByUrl(navs, "/dashboard/servers/42")).toEqual([
      navs[0],
      navs[0]?.items?.[0],
    ]);
  });

  it("does not match a similarly prefixed route", () => {
    expect(findNavByUrl(navs, "/dashboard/servers-archive/42")).toEqual([]);
  });
});
