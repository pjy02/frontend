import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const readProjectFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("protected Admin UI contract", () => {
  it("keeps the Admin theme and motion provider at the application root", () => {
    const main = readProjectFile("apps/admin/src/main.tsx");
    const theme = readProjectFile("apps/admin/src/styles/admin-theme.css");
    const motionProvider = readProjectFile(
      "apps/admin/src/components/motion-provider.tsx"
    );

    expect(main).toContain('import "./styles/admin-theme.css"');
    expect(main).toContain("<MotionProvider>");
    expect(main).toContain('classList.add("admin-console")');
    expect(theme).toContain("--admin-surface:");
    expect(theme).toContain("--admin-motion-easing:");
    expect(theme).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motionProvider).toContain("useReducedMotion()");
    expect(motionProvider).toContain("<MotionConfig");
  });

  it("keeps the local Header, Sidebar, page container, and content-only route transition", () => {
    const layout = readProjectFile("apps/admin/src/layout/index.tsx");
    const header = readProjectFile("apps/admin/src/layout/header.tsx");
    const sidebar = readProjectFile("apps/admin/src/layout/sidebar-left.tsx");

    expect(layout).toContain("<SidebarLeft />");
    expect(layout).toContain("<Header />");
    expect(layout).toContain('className="admin-shell"');
    expect(layout).toContain(
      'className="admin-content__inner admin-page-transition"'
    );
    expect(layout).toContain("key={pageTransitionKey}");
    expect(header).toContain('className="admin-header"');
    expect(sidebar).toContain('className="admin-sidebar"');
    expect(sidebar).toContain('className="admin-sidebar-active-indicator"');
    expect(sidebar).toContain('className="admin-sidebar-group-motion"');
  });

  it("keeps the customized Dashboard layout, ranking, and motion", () => {
    const dashboard = readProjectFile(
      "apps/admin/src/sections/dashboard/components/statistics.tsx"
    );
    const trafficRankingPosition = dashboard.indexOf("<TrafficRanking");
    const businessTrendsPosition = dashboard.indexOf("<BusinessTrends");

    expect(dashboard).toContain("import { PageHeader }");
    expect(dashboard).toContain("import { StatusChip");
    expect(dashboard).toContain(
      "DashboardFadeThrough transitionKey={trafficType}"
    );
    expect(dashboard).toContain("getTrafficRankWidth(item.total, leaderTotal)");
    expect(dashboard).toContain("function TrafficRanking(");
    expect(trafficRankingPosition).toBeGreaterThan(-1);
    expect(businessTrendsPosition).toBeGreaterThan(trafficRankingPosition);
  });

  it("keeps responsive ProTable cards and the viewport-fixed batch toolbar", () => {
    const proTable = readProjectFile(
      "packages/ui/src/composed/pro-table/pro-table.tsx"
    );

    expect(proTable).toContain("<DefaultMobileCard");
    expect(proTable).toContain("<SortableMobileCard");
    expect(proTable).toContain('className="admin-pro-table-mobile');
    expect(proTable).toContain("createPortal(");
    expect(proTable).toContain("pointer-events-none fixed inset-x-3 bottom-");
    expect(proTable).toContain('className="admin-batch-actions');
    expect(proTable).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps complex user and server workspaces out of the raw side Sheet", () => {
    const workspaceAdapter = readProjectFile(
      "apps/admin/src/components/settings-workspace.tsx"
    );
    const workspaceDialog = readProjectFile(
      "apps/admin/src/components/workspace-dialog.tsx"
    );
    const protectedWorkspaces = [
      "apps/admin/src/sections/user/index.tsx",
      "apps/admin/src/sections/user/user-form.tsx",
      "apps/admin/src/sections/user/user-subscription/subscription-detail.tsx",
      "apps/admin/src/sections/user/user-subscription/subscription-form.tsx",
      "apps/admin/src/sections/servers/server-form.tsx",
      "apps/admin/src/sections/servers/server-config.tsx",
      "apps/admin/src/sections/servers/server-node-config.tsx",
      "apps/admin/src/sections/servers/server-install.tsx",
      "apps/admin/src/sections/servers/dynamic-multiplier.tsx",
    ].map(readProjectFile);

    expect(workspaceAdapter).toContain("WorkspaceDialog as Sheet");
    expect(workspaceDialog).toContain(
      'className={cn(\n        "admin-workspace-dialog'
    );
    for (const source of protectedWorkspaces) {
      expect(source).not.toContain("@workspace/ui/components/sheet");
      expect(source).toMatch(
        /@\/components\/(?:settings-workspace|workspace-dialog)/
      );
    }
  });

  it("lands upstream Admin features in the local page, status, and dialog system", () => {
    const withdrawal = readProjectFile(
      "apps/admin/src/sections/withdrawal/index.tsx"
    );
    const logPage = readProjectFile(
      "apps/admin/src/sections/log/components/log-page.tsx"
    );
    const requestSource = readProjectFile(
      "apps/admin/src/sections/log/request-source.tsx"
    );

    expect(withdrawal).toContain('from "@/components/page-header"');
    expect(withdrawal).toContain('from "@/components/commerce-display"');
    expect(withdrawal).toContain("CommissionStatusChip");
    expect(logPage).toContain('from "@/components/page-header"');
    expect(requestSource).toContain('from "@/components/workspace-dialog"');
    expect(requestSource).not.toContain("@workspace/ui/components/sheet");
  });
});
