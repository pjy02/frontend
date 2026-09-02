import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const fromRoot = (...segments: string[]) => path.join(repoRoot, ...segments);
const read = (relativePath: string) =>
  readFileSync(fromRoot(relativePath), "utf8");

describe("final admin route structure", () => {
  const routeTree = read("apps/admin/src/routeTree.gen.ts");
  const navs = read("apps/admin/src/layout/navs.ts");

  it("keeps commission management and order creation logs in routes and menus", () => {
    expect(
      existsSync(
        fromRoot("apps/admin/src/routes/dashboard/withdrawal.lazy.tsx")
      )
    ).toBe(true);
    expect(
      existsSync(fromRoot("apps/admin/src/routes/dashboard/log/order.lazy.tsx"))
    ).toBe(true);

    for (const route of ["/dashboard/withdrawal", "/dashboard/log/order"]) {
      expect(routeTree).toContain(`'${route}'`);
      expect(navs).toContain(`url: "${route}"`);
    }
  });

  it("contains no generated or hand-maintained plugin route fragments", () => {
    expect(
      existsSync(fromRoot("apps/admin/src/routes/dashboard/plugin.lazy.tsx"))
    ).toBe(false);
    expect(routeTree).not.toContain("DashboardPlugin");
    expect(routeTree).not.toContain("/dashboard/plugin");
    expect(navs).not.toContain("/dashboard/plugin");
  });

  it("keeps the generated-file warning and dashboard authorization route", () => {
    expect(routeTree).toContain("This file was automatically generated");
    expect(
      existsSync(fromRoot("apps/admin/src/routes/dashboard/route.tsx"))
    ).toBe(true);
  });

  it("translates the new order-log menu and page description", () => {
    const zhMenu = JSON.parse(
      read("apps/admin/public/assets/locales/zh-CN/menu.json")
    ) as Record<string, string>;
    const zhLog = JSON.parse(
      read("apps/admin/public/assets/locales/zh-CN/log.json")
    ) as { description?: Record<string, string> };

    expect(zhMenu["Order Creation"]).toBe("订单创建");
    expect(zhLog.description?.order).toBe(
      "追踪订单创建、支付来源、价格明细和请求信息。"
    );
  });
});
