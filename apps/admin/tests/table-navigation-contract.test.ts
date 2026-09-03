import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const readProjectFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("Admin table navigation contract", () => {
  it("keeps filters and pagination externally restorable without remounting ProTable", () => {
    const proTable = readProjectFile(
      "packages/ui/src/composed/pro-table/pro-table.tsx"
    );

    expect(proTable).toContain("initialPagination?:");
    expect(proTable).toContain("onPaginationChange?:");
    expect(proTable).toContain("previousInitialFiltersRef");
    expect(proTable).toContain("previousInitialPaginationRef");
  });

  it("syncs user, order, withdrawal, and unified log tables with URL state", () => {
    for (const relativePath of [
      "apps/admin/src/sections/user/index.tsx",
      "apps/admin/src/sections/order/index.tsx",
      "apps/admin/src/sections/withdrawal/index.tsx",
      "apps/admin/src/sections/log/components/log-page.tsx",
    ]) {
      const source = readProjectFile(relativePath);
      expect(source).toContain("initialPagination=");
      expect(source).toContain("onFiltersChange=");
      expect(source).toContain("onPaginationChange=");
      expect(source).not.toContain("key={JSON.stringify(initialFilters)}");
    }
  });

  it("keeps order logs in LogPage and user log links scoped to the selected user", () => {
    const orderLog = readProjectFile(
      "apps/admin/src/sections/log/order/index.tsx"
    );
    const user = readProjectFile("apps/admin/src/sections/user/index.tsx");
    const userSubscriptions = readProjectFile(
      "apps/admin/src/sections/user/user-subscription/index.tsx"
    );
    const main = readProjectFile("apps/admin/src/main.tsx");

    expect(orderLog).toContain("<LogPage<");
    expect(orderLog).not.toContain("<ProTable<");
    expect(user).toContain("search={{ user_id: String(userId) }}");
    expect(userSubscriptions).toContain(
      "search={{ user_id: userId, user_subscribe_id: row.id }}"
    );
    expect(userSubscriptions).toContain(
      "search={{ user_id: userId, subscribe_id: row.subscribe_id }}"
    );
    expect(main).toContain("scrollRestoration: true");
  });
});
