import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const readProjectFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("User action menu contract", () => {
  it("keeps profile and subscriptions visible while grouping secondary user actions", () => {
    const source = readProjectFile("apps/admin/src/sections/user/index.tsx");

    expect(source).toContain("visibleCount: 3");
    expect(source).toContain('id="user-logs"');
    expect(source).toContain('to="/dashboard/order"');
    expect(source).toContain('to: "/dashboard/log/login"');
    expect(source).toContain('to: "/dashboard/log/balance"');
    expect(source).toContain('to: "/dashboard/log/commission"');
    expect(source).toContain('to: "/dashboard/log/gift"');
    expect(source).toContain("search={{ user_id: String(userId) }}");
    expect(source).toContain("<AdminActionMenuDangerItem");
    expect(source).not.toContain("DropdownMenuContent");
    expect(source).not.toContain('className="w-48"');
  });

  it("groups subscription management and activity without changing log filters", () => {
    const source = readProjectFile(
      "apps/admin/src/sections/user/user-subscription/index.tsx"
    );

    expect(source).toContain("visibleCount: 2");
    expect(source).toContain('id="subscription-management"');
    expect(source).toContain('id="subscription-logs"');
    expect(source).toContain("loading={copying}");
    expect(source).toContain('to="/dashboard/log/subscribe"');
    expect(source).toContain('to="/dashboard/log/reset-subscribe"');
    expect(source).toContain('to="/dashboard/log/subscribe-traffic"');
    expect(source).toContain('to="/dashboard/log/traffic-details"');
    expect(source).toContain(
      "search={{ user_id: userId, user_subscribe_id: row.id }}"
    );
    expect(source).toContain(
      "search={{ user_id: userId, subscribe_id: row.subscribe_id }}"
    );
    expect(source).toContain("<AdminActionMenuDangerItem");
    expect(source).not.toContain("DropdownMenuContent");
  });

  it("keeps ProTable defaults compatible and opts into extra visible actions", () => {
    const source = readProjectFile(
      "packages/ui/src/composed/pro-table/pro-table.tsx"
    );

    expect(source).toContain("visibleCount?: number");
    expect(source).toContain("visibleCount = 1");
    expect(source).toContain("visibleItems.slice(0, normalizedVisibleCount)");
    expect(source).toContain("visibleItems.slice(normalizedVisibleCount)");
  });

  it("uses the shared mobile action panel with safe-area and 44px touch targets", () => {
    const source = readProjectFile(
      "apps/admin/src/components/admin-action-menu.tsx"
    );

    expect(source).toContain("useIsMobile()");
    expect(source).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(source).toContain("min-h-11");
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(source).toContain("setMobilePath(parentPath)");
  });
});
