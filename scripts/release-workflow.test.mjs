import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../.github/workflows/release.yml",
  import.meta.url
);

test("release workflow ignores documentation and automation-only paths", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  for (const ignoredPath of [
    "docs/**",
    ".github/**",
    "scripts/**",
    "packages/ui/openapi2ts.config.ts",
    "packages/ui/openapi-templates/**",
  ]) {
    assert.match(
      workflow,
      new RegExp(`['"]${ignoredPath.replaceAll("*", "\\*")}['"]`),
      `release workflow must ignore ${ignoredPath}`
    );
  }

  assert.match(workflow, /uses:\s*actions\/cache@v4/);
  assert.doesNotMatch(workflow, /uses:\s*actions\/cache@v3/);
});
