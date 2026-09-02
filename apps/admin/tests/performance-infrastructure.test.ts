import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);
const readProjectFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("performance infrastructure", () => {
  it("keeps dashboard, system logs, and online users on the live query policy", () => {
    const dashboard = readProjectFile(
      "apps/admin/src/sections/dashboard/components/statistics.tsx"
    );
    const systemLogs = readProjectFile(
      "apps/admin/src/sections/dashboard/components/system-logs-dialog.tsx"
    );
    const onlineUsers = readProjectFile(
      "apps/admin/src/sections/servers/online-users-cell.tsx"
    );

    expect(dashboard.match(/\.\.\.LIVE_QUERY_OPTIONS/g)).toHaveLength(4);
    expect(systemLogs).toContain("...LIVE_QUERY_OPTIONS");
    expect(onlineUsers).toContain("...LIVE_QUERY_OPTIONS");
  });

  it("does not suspend Markdown or Lottie content with an empty placeholder", () => {
    const markdown = readProjectFile("packages/ui/src/composed/markdown.tsx");
    const lottie = readProjectFile("packages/ui/src/composed/lottie.tsx");

    expect(markdown).toContain('data-slot="markdown-placeholder"');
    expect(lottie).toContain('data-slot="lottie-placeholder"');
    expect(markdown).not.toContain("<Suspense fallback={null}>");
    expect(lottie).not.toContain("<Suspense fallback={null}>");
  });
});
