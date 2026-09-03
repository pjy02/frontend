import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./triage-webhook.mjs", import.meta.url)
);

function makeWorkspace(context = { ok: true }) {
  const workspace = join(
    tmpdir(),
    `triage-webhook-${process.pid}-${Date.now()}-${Math.random()}`
  );
  mkdirSync(join(workspace, ".automation"), { recursive: true });
  writeFileSync(
    join(workspace, ".automation", "context.json"),
    `${JSON.stringify(context)}\n`
  );
  return workspace;
}

function runSender({ env, cwd = makeWorkspace() }) {
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

async function withServer(handler) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
    }
    const record = { request, body };
    requests.push(record);
    await handler(record, response, requests.length);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    requests,
    url: `http://127.0.0.1:${port}/webhook`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("sends issue events with automation env, signature, and GitHub metadata", async () => {
  const secret = "test-secret";
  const server = await withServer((_record, response) => {
    response.writeHead(202, { "content-type": "text/plain" });
    response.end("accepted");
  });

  try {
    const result = await runSender({
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: secret,
        GITHUB_EVENT_NAME: "issues",
        GITHUB_EVENT_ACTION: "opened",
        GITHUB_DELIVERY: "delivery-123",
        BRIDGE_WEBHOOK_URL: "http://127.0.0.1:1/wrong",
        BRIDGE_WEBHOOK_SECRET: "wrong-secret",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, "accepted\n");
    assert.equal(server.requests.length, 1);

    const [{ request, body }] = server.requests;
    const payload = JSON.parse(body);
    assert.equal(payload.eventType, "triage.issue");
    assert.equal(payload.trigger.eventName, "issues");
    assert.equal(payload.trigger.eventAction, "opened");
    assert.equal(request.headers["x-github-event"], "issues");
    assert.equal(request.headers["x-github-delivery"], "delivery-123");
    assert.equal(
      request.headers["x-webhook-signature-256"],
      `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
    );
  } finally {
    await server.close();
  }
});

test("sends pull_request_target events as triage.pull_request", async () => {
  const server = await withServer((_record, response) => {
    response.writeHead(202);
    response.end("accepted");
  });

  try {
    const result = await runSender({
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: "test-secret",
        GITHUB_EVENT_NAME: "pull_request_target",
        GITHUB_EVENT_ACTION: "synchronize",
        GITHUB_DELIVERY: "delivery-pr",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(server.requests[0].body);
    assert.equal(payload.eventType, "triage.pull_request");
    assert.equal(payload.trigger.kind, "pull_request");
    assert.equal(payload.trigger.eventName, "pull_request_target");
    assert.equal(payload.trigger.eventAction, "synchronize");
  } finally {
    await server.close();
  }
});

test("routes issue comments attached to pull requests as triage.pull_request", async () => {
  const server = await withServer((_record, response) => {
    response.writeHead(202);
    response.end("accepted");
  });

  try {
    const result = await runSender({
      cwd: makeWorkspace({ trigger: { issue: { isPullRequest: true } } }),
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: "test-secret",
        GITHUB_EVENT_NAME: "issue_comment",
        GITHUB_EVENT_ACTION: "created",
      },
    });
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(server.requests[0].body);
    assert.equal(payload.eventType, "triage.pull_request");
    assert.equal(payload.trigger.kind, "pull_request");
  } finally {
    await server.close();
  }
});

test("supports explicit automation event type override for openapi adaptation without changing GitHub headers", async () => {
  const secret = "test-secret";
  const server = await withServer((_record, response) => {
    response.writeHead(202);
    response.end("accepted");
  });

  try {
    const result = await runSender({
      cwd: makeWorkspace({ targetBranch: "develop" }),
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: secret,
        AUTOMATION_EVENT_TYPE: "openapi.adapt",
        AUTOMATION_DRY_RUN: "true",
        GITHUB_EVENT_NAME: "push",
        GITHUB_EVENT_ACTION: "",
        GITHUB_DELIVERY: "delivery-openapi",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const [{ request, body }] = server.requests;
    const payload = JSON.parse(body);
    assert.equal(payload.eventType, "openapi.adapt");
    assert.equal(payload.dryRun, true);
    assert.equal(payload.context.test, true);
    assert.equal(payload.repo, "perfect-panel/frontend");
    assert.equal(payload.trigger.kind, "push");
    assert.equal(payload.trigger.eventName, "push");
    assert.equal(payload.trigger.eventAction, "");
    assert.equal(request.headers["x-github-event"], "push");
    assert.equal(request.headers["x-github-delivery"], "delivery-openapi");
    assert.equal(
      request.headers["x-webhook-signature-256"],
      `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
    );
  } finally {
    await server.close();
  }
});

test("retries network errors and 5xx responses up to three times with configurable short delay", async () => {
  const server = await withServer((_record, response, attempt) => {
    if (attempt < 3) {
      response.writeHead(502);
      response.end(`bad gateway ${attempt}`);
      return;
    }
    response.writeHead(202);
    response.end("accepted after retry");
  });

  try {
    const result = await runSender({
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: "test-secret",
        GITHUB_EVENT_NAME: "issues",
        GITHUB_EVENT_ACTION: "opened",
        WEBHOOK_RETRY_DELAY_MS: "1",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, "accepted after retry\n");
    assert.equal(server.requests.length, 3);
  } finally {
    await server.close();
  }
});

test("does not retry 4xx responses", async () => {
  const server = await withServer((_record, response) => {
    response.writeHead(401);
    response.end("unauthorized");
  });

  try {
    const result = await runSender({
      env: {
        AUTOMATION_WEBHOOK_URL: server.url,
        AUTOMATION_WEBHOOK_SECRET: "test-secret",
        GITHUB_EVENT_NAME: "issues",
        GITHUB_EVENT_ACTION: "opened",
        WEBHOOK_RETRY_DELAY_MS: "1",
      },
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /401 unauthorized/);
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
  }
});
