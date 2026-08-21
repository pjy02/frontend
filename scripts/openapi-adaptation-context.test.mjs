import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scriptPath = new URL("./openapi-adaptation-context.mjs", import.meta.url)
  .pathname;

function makeWorkspace(event) {
  const workspace = mkdtempSync(join(tmpdir(), "openapi-adaptation-context-"));
  const eventPath = join(workspace, "event.json");
  writeFileSync(eventPath, `${JSON.stringify(event)}\n`);
  return { workspace, eventPath };
}

function runContext({ env, cwd }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("builds openapi adaptation context from a push event and only includes changed swagger JSON files", async () => {
  const event = {
    ref: "refs/heads/main",
    before: "1111111111111111111111111111111111111111",
    after: "2222222222222222222222222222222222222222",
    repository: {
      full_name: "perfect-panel/frontend",
      html_url: "https://github.com/perfect-panel/frontend",
    },
    head_commit: {
      id: "2222222222222222222222222222222222222222",
      message: "update swagger",
      timestamp: "2026-08-09T00:00:00Z",
      url: "https://github.com/perfect-panel/frontend/commit/2222222",
      author: { name: "Backend CI" },
      added: [
        "docs/public/swagger/admin.json",
        "docs/public/swagger/nested/ignored.json",
      ],
      modified: ["docs/public/swagger/user.json", "README.md"],
      removed: [
        "docs/public/swagger/legacy.json",
        "docs/public/swagger/openapi.yaml",
      ],
    },
    commits: [
      {
        id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        url: "https://github.com/perfect-panel/frontend/commit/aaaaaaaa",
        added: ["docs/public/swagger/admin.json"],
        modified: ["docs/public/swagger/user.json"],
        removed: [],
      },
      {
        id: "2222222222222222222222222222222222222222",
        url: "https://github.com/perfect-panel/frontend/commit/2222222",
        added: ["docs/public/swagger/nested/ignored.json"],
        modified: ["README.md"],
        removed: ["docs/public/swagger/legacy.json"],
      },
    ],
  };
  const { workspace, eventPath } = makeWorkspace(event);

  const result = await runContext({
    cwd: workspace,
    env: {
      GITHUB_EVENT_NAME: "push",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "perfect-panel/frontend",
      GITHUB_SHA: event.after,
      GITHUB_REF: event.ref,
      AUTOMATION_WEBHOOK_SECRET: "must-not-leak",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(
    readFileSync(join(workspace, ".automation", "context.json"), "utf8")
  );
  assert.equal(report.eventName, "push");
  assert.equal(report.repo, "perfect-panel/frontend");
  assert.equal(report.sourceRef, "refs/heads/main");
  assert.equal(report.sourceBranch, "main");
  assert.equal(report.beforeSha, event.before);
  assert.equal(report.afterSha, event.after);
  assert.equal(report.commitUrl, event.head_commit.url);
  assert.deepEqual(report.triggerCommit, {
    sha: event.head_commit.id,
    message: "update swagger",
    url: event.head_commit.url,
    timestamp: "2026-08-09T00:00:00Z",
    author: "Backend CI",
  });
  assert.deepEqual(report.changedSwaggerFiles, {
    added: ["docs/public/swagger/admin.json"],
    modified: ["docs/public/swagger/user.json"],
    removed: ["docs/public/swagger/legacy.json"],
    all: [
      "docs/public/swagger/admin.json",
      "docs/public/swagger/user.json",
      "docs/public/swagger/legacy.json",
    ],
  });
  assert.equal(report.targetBranch, "develop");
  assert.deepEqual(report.requiredCommands, [
    "bun run openapi",
    "bun run check",
    "bun run test",
    "bun --filter ppanel-admin-web build",
    "bun --filter ppanel-user-web build",
  ]);
  assert.equal(JSON.stringify(report).includes("must-not-leak"), false);
});

test("builds dispatch context from workflow metadata when event payload has no push commits", async () => {
  const { workspace, eventPath } = makeWorkspace({ inputs: {} });

  const result = await runContext({
    cwd: workspace,
    env: {
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: "perfect-panel/frontend",
      GITHUB_SHA: "3333333333333333333333333333333333333333",
      GITHUB_REF: "refs/heads/main",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(
    readFileSync(join(workspace, ".automation", "context.json"), "utf8")
  );
  assert.equal(report.eventName, "workflow_dispatch");
  assert.equal(report.sourceBranch, "main");
  assert.equal(report.afterSha, "3333333333333333333333333333333333333333");
  assert.deepEqual(report.changedSwaggerFiles, {
    added: [],
    modified: [],
    removed: [],
    all: [],
  });
  assert.equal(report.targetBranch, "develop");
});
