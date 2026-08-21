import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const eventName = process.env.GITHUB_EVENT_NAME || "unknown";
const eventPath = process.env.GITHUB_EVENT_PATH;
const repo = process.env.GITHUB_REPOSITORY || "perfect-panel/frontend";
const envSha = process.env.GITHUB_SHA || null;
const envRef = process.env.GITHUB_REF || null;

const event =
  eventPath && existsSync(eventPath)
    ? JSON.parse(readFileSync(eventPath, "utf8"))
    : {};

const sourceRef = event.ref || envRef || null;
const sourceBranch = sourceRef?.startsWith("refs/heads/")
  ? sourceRef.slice("refs/heads/".length)
  : sourceRef;
const beforeSha = event.before || null;
const afterSha = event.after || envSha || null;
const headCommit = event.head_commit || null;

const swaggerJsonPattern = /^docs\/public\/swagger\/[^/]+\.json$/;

function unique(values) {
  return [...new Set(values)];
}

function changedFilesFor(kind) {
  const commitFiles = (event.commits || []).flatMap(
    (commit) => commit[kind] || []
  );
  const headFiles = headCommit?.[kind] || [];
  return unique(
    [...commitFiles, ...headFiles].filter((file) =>
      swaggerJsonPattern.test(file)
    )
  );
}

const added = changedFilesFor("added");
const modified = changedFilesFor("modified");
const removed = changedFilesFor("removed");

const report = {
  generatedAt: new Date().toISOString(),
  eventName,
  repo,
  sourceRef,
  sourceBranch,
  beforeSha,
  afterSha,
  commitUrl:
    headCommit?.url ||
    (afterSha && event.repository?.html_url
      ? `${event.repository.html_url}/commit/${afterSha}`
      : null),
  triggerCommit: headCommit
    ? {
        sha: headCommit.id || headCommit.sha || afterSha,
        message: headCommit.message || "",
        url: headCommit.url || null,
        timestamp: headCommit.timestamp || null,
        author: headCommit.author?.name || headCommit.author?.username || null,
      }
    : null,
  changedSwaggerFiles: {
    added,
    modified,
    removed,
    all: unique([...added, ...modified, ...removed]),
  },
  targetBranch: "develop",
  requiredCommands: [
    "bun run openapi",
    "bun run check",
    "bun run test",
    "bun --filter ppanel-admin-web build",
    "bun --filter ppanel-user-web build",
  ],
};

mkdirSync(".automation", { recursive: true });
writeFileSync(
  join(".automation", "context.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report, null, 2));
