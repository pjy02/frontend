import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../${file}`, import.meta.url)),
    "utf8"
  );
const pages = [
  "balance",
  "commission",
  "gift",
  "login",
  "register",
  "reset-subscribe",
  "server-traffic",
  "subscribe-traffic",
  "subscribe",
  "traffic-details",
  "order",
];
describe("log integration boundaries", () => {
  it.each(pages)("keeps %s in LogPage and sends range parameters", (page) => {
    const source = read(`apps/admin/src/sections/log/${page}/index.tsx`);
    expect(source).toContain("<LogPage<");
    expect(source).not.toContain("<ProTable<");
    expect(source).toContain("start_date:");
    expect(source).toContain("end_date:");
    expect(source).not.toMatch(/date:\s*filter\??\.date/);
    expect(source).not.toContain("<<<<<<<");
  });
  it.each([
    "email",
    "mobile",
  ])("keeps %s in the common message-log wrapper", (page) => {
    expect(read(`apps/admin/src/sections/log/${page}/index.tsx`)).toContain(
      "<MessageLogPage"
    );
    const wrapper = read(
      "apps/admin/src/sections/log/components/message-log-page.tsx"
    );
    expect(wrapper).toContain("<LogPage<");
    expect(wrapper).toContain("start_date");
    expect(wrapper).toContain("end_date");
  });
  it("registers both new log routes in menus, the generated tree and existing search source", () => {
    for (const route of [
      "/dashboard/log/admin",
      "/dashboard/log/payment-unmatched",
    ]) {
      expect(read("apps/admin/src/routeTree.gen.ts")).toContain(route);
      expect(read("apps/admin/src/layout/navs.ts")).toContain(route);
      expect(read("apps/admin/src/sections/log/log-navigation.tsx")).toContain(
        route
      );
    }
    expect(read("apps/admin/src/layout/admin-search.tsx")).toContain(
      "flattenNavs(navs)"
    );
  });
  it("keeps dashboard traffic links and all user/subscription/server identifiers", () => {
    const dashboard = read(
      "apps/admin/src/sections/dashboard/components/statistics.tsx"
    );
    expect(dashboard).toContain("/dashboard/log/server-traffic");
    expect(dashboard).toContain("/dashboard/log/subscribe-traffic");
    expect(dashboard).toContain("user_id");
    expect(dashboard).toContain("server_id");
    expect(
      read("apps/admin/src/sections/log/traffic-details/index.tsx")
    ).toContain("subscribe_id: filter.subscribe_id");
    expect(read("apps/admin/src/sections/log/subscribe/index.tsx")).toContain(
      "user_subscribe_id: filter.user_subscribe_id"
    );
  });
});
