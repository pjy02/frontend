import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
function runtimeSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSources(file);
    return /\.(ts|tsx)$/.test(file) && !/\.(test|d)\.tsx?$/.test(file)
      ? [readFileSync(file, "utf8")]
      : [];
  });
}
function localeKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? localeKeys(child as Record<string, unknown>, name)
      : [name.replace(/_(zero|one|two|few|many|other)$/, "")];
  });
}

describe("v1.22 integration boundaries", () => {
  it("keeps health probes, device sockets and entitlement_source out of runtime page behavior", () => {
    for (const app of ["admin", "user"])
      for (const source of runtimeSources(path.join(root, "apps", app, "src")))
        expect(source).not.toMatch(
          /\b(getHealthz|getReadyz|getV1AppWsUseridIdentifier|entitlement_source)\b/
        );
  });
  it("retains generated interfaces without claiming a WebSocket connection", () => {
    expect(read("packages/ui/src/services/common/common.ts")).toContain(
      "export async function getHealthz("
    );
    expect(read("packages/ui/src/services/common/common.ts")).toContain(
      "export async function getReadyz("
    );
    const user = read("packages/ui/src/services/user/user.ts");
    expect(user).toContain("export async function getV1AppWsUseridIdentifier(");
    expect(user).not.toContain("new WebSocket(");
    for (const app of ["admin", "user"])
      expect(read(`packages/ui/src/services/${app}/typings.d.ts`)).toContain(
        "entitlement_source"
      );
  });
  it("does not broaden the development or deployed Pages proxy to non-versioned probes", () => {
    expect(read("scripts/api-dev-proxy.ts")).toContain("/v[12](?:/|$)");
    expect(read("scripts/api-dev-proxy.ts")).not.toMatch(
      /healthz|readyz|\/basic/
    );
    expect(read("functions/v1/[[path]].ts")).toContain('redirect: "manual"');
  });
  it("keeps User locale namespaces and normalized keys symmetric", () => {
    const base = path.join(root, "apps/user/public/assets/locales");
    const files = readdirSync(path.join(base, "en-US"))
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(
      readdirSync(path.join(base, "zh-CN"))
        .filter((file) => file.endsWith(".json"))
        .sort()
    ).toEqual(files);
    for (const file of files) {
      const keys = (language: string) =>
        [
          ...new Set(
            localeKeys(
              JSON.parse(readFileSync(path.join(base, language, file), "utf8"))
            )
          ),
        ].sort();
      expect(keys("zh-CN"), file).toEqual(keys("en-US"));
    }
  });
});
