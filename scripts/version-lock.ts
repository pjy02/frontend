import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

export function versionLockPlugin(): Plugin {
  return {
    name: "version-lock",
    apply: "build",
    generateBundle() {
      const { version } = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8")
      );
      this.emitFile({
        type: "asset",
        fileName: "version.lock",
        source: version,
      });
    },
  };
}
