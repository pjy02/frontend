import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isBundledIcon } from "./icons";

const iconPattern =
  /(?:flat-color-icons|logos|lucide|mdi|simple-icons|tabler|uil):[a-z0-9-]+/g;

function readSourceTree(url: URL): string[] {
  const path = fileURLToPath(url);
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      url
    );
    if (entry.isDirectory()) {
      return readSourceTree(child);
    }
    return /\.(?:ts|tsx)$/.test(entry.name)
      ? [readFileSync(fileURLToPath(child), "utf8")]
      : [];
  });
}

describe("bundled Iconify registry", () => {
  it("contains every static icon used by the Admin and User applications", () => {
    const sources = [
      ...readSourceTree(
        new URL("../../../../apps/admin/src/", import.meta.url)
      ),
      ...readSourceTree(new URL("../../../../apps/user/src/", import.meta.url)),
    ];
    const usedIcons = new Set(
      sources.flatMap((source) => source.match(iconPattern) ?? [])
    );
    const missingIcons = [...usedIcons].filter((name) => !isBundledIcon(name));

    expect(missingIcons).toEqual([]);
  });
});
