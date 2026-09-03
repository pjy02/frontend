import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./triage-context.mjs", import.meta.url)
);

function makeWorkspace(event) {
  const workspace = mkdtempSync(join(tmpdir(), "triage-context-"));
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

async function withGithubFixture(routes) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    const payload = routes[request.url];
    if (payload === undefined) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ message: `No fixture for ${request.url}` })
      );
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    requests,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("keeps issue context behavior and filters PR-shaped issues from openIssues", async () => {
  const event = {
    action: "opened",
    issue: {
      number: 7,
      title: "Broken checkout",
      body: "Steps to reproduce",
      html_url: "https://github.com/perfect-panel/frontend/issues/7",
      labels: [{ name: "bug" }],
      user: { login: "alice" },
    },
    comment: {
      id: 9,
      body: "still broken",
      html_url:
        "https://github.com/perfect-panel/frontend/issues/7#issuecomment-9",
      user: { login: "bob" },
      created_at: "2026-08-09T00:00:00Z",
    },
  };
  const fixture = await withGithubFixture({
    "/repos/perfect-panel/frontend/issues?state=open&per_page=50": [
      {
        number: 7,
        title: "Broken checkout",
        html_url: "https://github.com/perfect-panel/frontend/issues/7",
        labels: [{ name: "bug" }],
        created_at: "2026-08-08T00:00:00Z",
      },
      {
        number: 8,
        title: "PR-shaped issue",
        html_url: "https://github.com/perfect-panel/frontend/pull/8",
        labels: [],
        created_at: "2026-08-08T00:00:00Z",
        pull_request: {},
      },
    ],
  });
  const { workspace, eventPath } = makeWorkspace(event);

  try {
    const result = await runContext({
      cwd: workspace,
      env: {
        TRIAGE_TOKEN: "token",
        GITHUB_API_BASE_URL: fixture.baseUrl,
        GITHUB_EVENT_NAME: "issues",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "perfect-panel/frontend",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(join(workspace, ".automation", "context.json"), "utf8")
    );
    assert.equal(report.eventName, "issues");
    assert.deepEqual(report.trigger.issue, {
      number: 7,
      title: "Broken checkout",
      body: "Steps to reproduce",
      url: "https://github.com/perfect-panel/frontend/issues/7",
      labels: ["bug"],
      user: "alice",
      isPullRequest: false,
    });
    assert.deepEqual(report.openIssues, [
      {
        number: 7,
        title: "Broken checkout",
        url: "https://github.com/perfect-panel/frontend/issues/7",
        labels: ["bug"],
        createdAt: "2026-08-08T00:00:00Z",
      },
    ]);
    assert.equal("pullRequest" in report.trigger, false);
    assert.equal("openPullRequests" in report, false);
  } finally {
    await fixture.close();
  }
});

test("marks issue comments attached to pull requests for PR routing", async () => {
  const event = {
    action: "created",
    issue: {
      number: 42,
      title: "Improve billing",
      body: "PR body",
      html_url: "https://github.com/perfect-panel/frontend/pull/42",
      labels: [],
      user: { login: "carol" },
      pull_request: {},
    },
  };
  const fixture = await withGithubFixture({
    "/repos/perfect-panel/frontend/issues?state=open&per_page=50": [],
  });
  const { workspace, eventPath } = makeWorkspace(event);

  try {
    const result = await runContext({
      cwd: workspace,
      env: {
        TRIAGE_TOKEN: "token",
        GITHUB_API_BASE_URL: fixture.baseUrl,
        GITHUB_EVENT_NAME: "issue_comment",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "perfect-panel/frontend",
      },
    });
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(
      readFileSync(join(workspace, ".automation", "context.json"), "utf8")
    );
    assert.equal(report.trigger.issue.isPullRequest, true);
  } finally {
    await fixture.close();
  }
});

test("builds pull_request_target context with trigger PR and open PR list from injectable GitHub API base", async () => {
  const event = {
    action: "synchronize",
    pull_request: {
      number: 42,
      title: "Improve billing",
      body: "Adds safer billing copy",
      html_url: "https://github.com/perfect-panel/frontend/pull/42",
      draft: true,
      base: { ref: "develop" },
      head: { ref: "feature/billing" },
      labels: [{ name: "enhancement" }],
      user: { login: "carol" },
    },
  };
  const fixture = await withGithubFixture({
    "/repos/perfect-panel/frontend/issues?state=open&per_page=50": [],
    "/repos/perfect-panel/frontend/pulls?state=open&per_page=50": [
      {
        number: 42,
        title: "Improve billing",
        body: "Adds safer billing copy",
        html_url: "https://github.com/perfect-panel/frontend/pull/42",
        draft: true,
        base: { ref: "develop" },
        head: { ref: "feature/billing" },
        labels: [{ name: "enhancement" }],
        user: { login: "carol" },
      },
      {
        number: 43,
        title: "Fix docs",
        body: "Updates the API guide",
        html_url: "https://github.com/perfect-panel/frontend/pull/43",
        draft: false,
        base: { ref: "main" },
        head: { ref: "docs" },
        labels: [],
        user: { login: "dave" },
      },
    ],
  });
  const { workspace, eventPath } = makeWorkspace(event);

  try {
    const result = await runContext({
      cwd: workspace,
      env: {
        TRIAGE_TOKEN: "token",
        GITHUB_API_BASE_URL: fixture.baseUrl,
        GITHUB_EVENT_NAME: "pull_request_target",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "perfect-panel/frontend",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(fixture.requests.sort(), [
      "/repos/perfect-panel/frontend/issues?state=open&per_page=50",
      "/repos/perfect-panel/frontend/pulls?state=open&per_page=50",
    ]);

    const report = JSON.parse(
      readFileSync(join(workspace, ".automation", "context.json"), "utf8")
    );
    assert.equal(report.eventName, "pull_request_target");
    assert.deepEqual(report.trigger.pullRequest, {
      number: 42,
      title: "Improve billing",
      body: "Adds safer billing copy",
      url: "https://github.com/perfect-panel/frontend/pull/42",
      draft: true,
      baseRef: "develop",
      headRef: "feature/billing",
      labels: ["enhancement"],
      user: "carol",
    });
    assert.deepEqual(report.openPullRequests, [
      {
        number: 42,
        title: "Improve billing",
        body: "Adds safer billing copy",
        url: "https://github.com/perfect-panel/frontend/pull/42",
        draft: true,
        baseRef: "develop",
        headRef: "feature/billing",
        labels: ["enhancement"],
        user: "carol",
      },
      {
        number: 43,
        title: "Fix docs",
        body: "Updates the API guide",
        url: "https://github.com/perfect-panel/frontend/pull/43",
        draft: false,
        baseRef: "main",
        headRef: "docs",
        labels: [],
        user: "dave",
      },
    ]);
    assert.deepEqual(report.openIssues, []);
  } finally {
    await fixture.close();
  }
});
