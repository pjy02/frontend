import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url))
);

const fromRoot = (...segments: string[]) => path.join(repoRoot, ...segments);

const readSourceTree = (relativePath: string): string[] => {
  const absolutePath = fromRoot(relativePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      return readSourceTree(childPath);
    }
    return /\.(?:json|mjs|ts|tsx)$/.test(entry.name)
      ? [readFileSync(fromRoot(childPath), "utf8")]
      : [];
  });
};

describe("admin plugin management removal", () => {
  it("does not retain plugin management pages, routes, locales, or services", () => {
    for (const removedPath of [
      "apps/admin/src/sections/plugin",
      "apps/admin/src/routes/dashboard/plugin.lazy.tsx",
      "apps/admin/public/assets/locales/en-US/plugin.json",
      "apps/admin/public/assets/locales/zh-CN/plugin.json",
      "packages/ui/src/services/admin/plugin.ts",
    ]) {
      expect(existsSync(fromRoot(removedPath))).toBe(false);
    }
  });

  it("does not expose the removed feature through generated routes or shell metadata", () => {
    const sources = [
      "apps/admin/src/routeTree.gen.ts",
      "apps/admin/src/layout/navs.ts",
      "apps/admin/src/config/i18n.ts",
      "apps/admin/tests/mock-api.mjs",
    ].map((file) => readFileSync(fromRoot(file), "utf8"));

    for (const source of sources) {
      expect(source).not.toContain("/dashboard/plugin");
      expect(source).not.toContain("services/admin/plugin");
      expect(source).not.toContain("PluginManagement");
      expect(source).not.toContain('"plugin"');
    }
  });

  it("does not retain plugin-management API types, exports, or mocks", () => {
    const source = [
      ...readSourceTree("apps/admin/src"),
      ...readSourceTree("apps/admin/public/assets/locales"),
      ...readSourceTree("packages/ui/src/services"),
      readFileSync(fromRoot("apps/admin/tests/mock-api.mjs"), "utf8"),
    ].join("\n");

    for (const removedIdentifier of [
      "/v1/admin/plugins",
      "PluginStatus",
      "PluginInfo",
      "PluginManifest",
      "PluginEventSubscription",
      "PluginInstallResult",
      "getPluginList",
      "reloadAllPlugins",
      "uploadPluginPackage",
    ]) {
      expect(source).not.toContain(removedIdentifier);
    }
  });

  it("uses the shared not-found state for unknown dashboard routes", () => {
    const dashboardRoute = readFileSync(
      fromRoot("apps/admin/src/routes/dashboard/route.lazy.tsx"),
      "utf8"
    );

    expect(dashboardRoute).toContain("notFoundComponent");
    expect(dashboardRoute).toContain("<NotFoundPage contained />");
  });
});
