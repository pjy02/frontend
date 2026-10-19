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
  it("does not let dashboard shadow specific destinations and chooses the deepest match", () => {
    const routes: NavItem[] = [
      { title: "Dashboard", url: "/dashboard" },
      ...navs,
      { title: "Settings", url: "/dashboard/system" },
      { title: "Server logs", url: "/dashboard/servers/log" },
    ];
    expect(findNavByUrl(routes, "/dashboard/system/").at(-1)?.title).toBe(
      "Settings"
    );
    expect(
      findNavByUrl(routes, "/dashboard/servers/log/42").at(-1)?.title
    ).toBe("Server logs");
    expect(findNavByUrl(routes, "/dashboard/unknown")).toEqual([]);
    expect(findNavByUrl(routes, "/dashboard").at(-1)?.title).toBe("Dashboard");
  });
  it("matches dynamic segments without interpreting static paths as regex", () => {
    const routes: NavItem[] = [
      { title: "Dynamic", url: "/dashboard/item/:id" },
      { title: "Static", url: "/dashboard/item/new" },
    ];
    expect(findNavByUrl(routes, "/dashboard/item/new").at(-1)?.title).toBe(
      "Static"
    );
    expect(findNavByUrl(routes, "/dashboard/item/12").at(-1)?.title).toBe(
      "Dynamic"
    );
  });
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
