import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const read = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("Admin action menu rollout", () => {
  it("uses the shared action menu on tables with secondary actions", () => {
    for (const relativePath of [
      "apps/admin/src/sections/servers/index.tsx",
      "apps/admin/src/sections/nodes/index.tsx",
      "apps/admin/src/sections/product/subscribe-table.tsx",
      "apps/admin/src/sections/coupon/index.tsx",
      "apps/admin/src/sections/payment/payment-table.tsx",
      "apps/admin/src/sections/ticket/index.tsx",
    ]) {
      const source = read(relativePath);
      expect(source).toContain("<AdminActionMenu");
      expect(source).toContain("visibleCount: 2");
      expect(source).toContain("moreTriggerRef");
    }
  });

  it("does not add redundant menus to order and one-action log pages", () => {
    for (const relativePath of [
      "apps/admin/src/sections/order/index.tsx",
      "apps/admin/src/sections/log/server-traffic/index.tsx",
      "apps/admin/src/sections/log/subscribe-traffic/index.tsx",
    ]) {
      expect(read(relativePath)).not.toContain("AdminActionMenu");
    }
  });

  it("keeps user-related business pages free of legacy dropdown composition", () => {
    for (const relativePath of [
      "apps/admin/src/sections/user/index.tsx",
      "apps/admin/src/sections/user/user-subscription/index.tsx",
      "apps/admin/src/sections/user/user-subscription/subscription-detail.tsx",
      "apps/admin/src/sections/user/user-profile/auth-methods-form.tsx",
      "apps/admin/src/sections/user/user-profile/basic-info-form.tsx",
      "apps/admin/src/sections/user/user-profile/notify-settings-form.tsx",
    ]) {
      expect(read(relativePath)).not.toContain("DropdownMenuContent");
    }
  });

  it("provides localized menu, loading, and failure labels", () => {
    const namespaces = [
      "user",
      "servers",
      "nodes",
      "product",
      "payment",
      "coupon",
      "ticket",
    ];
    for (const namespace of namespaces) {
      const zh = JSON.parse(
        read(`apps/admin/public/assets/locales/zh-CN/${namespace}.json`)
      ) as Record<string, string>;
      const en = JSON.parse(
        read(`apps/admin/public/assets/locales/en-US/${namespace}.json`)
      ) as Record<string, string>;

      expect(zh.moreActions).toBe("更多操作");
      expect(en.moreActions).toBe("More actions");
      expect(zh.actionsDescription ?? zh.userActionsDescription).toBeTruthy();
      expect(en.actionsDescription ?? en.userActionsDescription).toBeTruthy();
    }

    const zhUser = JSON.parse(
      read("apps/admin/public/assets/locales/zh-CN/user.json")
    ) as Record<string, string>;
    expect(zhUser.logsAndRecords).toBe("日志与记录");
    expect(zhUser.logsAndStatistics).toBe("日志与统计");
    expect(zhUser.subscriptionManagement).toBe("订阅管理");
    expect(zhUser.back).toBe("返回");
    expect(zhUser.deleteUser).toBe("删除用户");
    expect(zhUser.deleteSubscription).toBe("删除订阅");
    expect(zhUser.copyingSubscription).toBe("正在复制订阅地址");
    expect(zhUser.copyFailed).not.toMatch(/More|Delete|Logs|Loading/i);
  });
});
