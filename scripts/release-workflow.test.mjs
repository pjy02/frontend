import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("release workflow can be run manually and uses the repository token as a fallback", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s+contents: write/);
  assert.match(
    workflow,
    /GH_TOKEN: \$\{\{ secrets\.GH_TOKEN \|\| github\.token \}\}/
  );
});

test("release workflow installs frozen dependencies using the repository Bun version", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const { packageManager } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );
  assert.ok(
    workflow.includes(`bun-version: '${packageManager.split("@")[1]}'`)
  );
  assert.match(workflow, /run: bun install --frozen-lockfile/);
});

test("publish waits for frontend tests, four archive checks, and browser smoke", async () => {
  const release = await readFile(workflowUrl, "utf8");
  const verification = await readFile(
    new URL("../.github/workflows/verify.yml", import.meta.url),
    "utf8"
  );
  assert.match(release, /uses: \.\/\.github\/workflows\/verify\.yml/);
  assert.match(release, /needs: verify/);
  assert.match(verification, /workflow_call:/);
  assert.match(verification, /permissions:\s+contents: read/);
  assert.match(verification, /run: bun run test/);
  assert.match(verification, /run: node scripts\/prepare-release\.mjs/);
  assert.match(verification, /run: node scripts\/check-release-smoke\.mjs/);
});

test("the fork does not schedule an unattended develop-to-main merge", async () => {
  const weeklyMerge = new URL(
    "../.github/workflows/weekly-merge.yml",
    import.meta.url
  );
  await assert.rejects(access(weeklyMerge), { code: "ENOENT" });
});
