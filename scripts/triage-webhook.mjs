import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const webhookUrl = process.env.AUTOMATION_WEBHOOK_URL;
const webhookSecret = process.env.AUTOMATION_WEBHOOK_SECRET;

if (!(webhookUrl && webhookSecret)) {
  console.error(
    "AUTOMATION_WEBHOOK_URL and AUTOMATION_WEBHOOK_SECRET are required"
  );
  process.exit(1);
}

const context = JSON.parse(readFileSync(".automation/context.json", "utf8"));
const githubEventName = process.env.GITHUB_EVENT_NAME || "unknown";
const isPullRequest =
  githubEventName === "pull_request_target" ||
  context.trigger?.issue?.isPullRequest === true;
const explicitEventType = process.env.AUTOMATION_EVENT_TYPE;
const eventType =
  explicitEventType || (isPullRequest ? "triage.pull_request" : "triage.issue");
const dryRun = process.env.AUTOMATION_DRY_RUN === "true";
const payloadContext = dryRun ? { ...context, test: true } : context;

const payload = {
  eventType,
  dryRun,
  repo: "perfect-panel/frontend",
  source: "github-actions",
  trigger: {
    kind: isPullRequest
      ? "pull_request"
      : githubEventName === "push"
        ? "push"
        : "issue",
    eventName: githubEventName,
    eventAction: process.env.GITHUB_EVENT_ACTION || "",
  },
  context: payloadContext,
};

const rawBody = JSON.stringify(payload);
const signature = `sha256=${createHmac("sha256", webhookSecret).update(rawBody).digest("hex")}`;
const headers = {
  "content-type": "application/json",
  "x-github-delivery": process.env.GITHUB_DELIVERY || "",
  "x-github-event": githubEventName,
  "x-webhook-signature-256": signature,
};
const retryDelayMs = Number(process.env.WEBHOOK_RETRY_DELAY_MS || 1000);
let lastFailure = "unknown error";

for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: rawBody,
    });
    const text = await response.text();

    if (response.ok) {
      console.log(text);
      process.exit(0);
    }

    lastFailure = `${response.status} ${text}`;
    if (response.status < 500) {
      break;
    }
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }

  if (attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }
}

console.error(`Webhook request failed after retries: ${lastFailure}`);
process.exit(1);
