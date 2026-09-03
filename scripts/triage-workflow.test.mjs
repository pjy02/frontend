import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/triage-automation.yml",
  "utf8"
).replaceAll("\r\n", "\n");

test("triage workflow keeps existing issue, open comment, and manual triggers", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /event_type:/);
  assert.match(workflow, /dry_run:/);
  assert.match(
    workflow,
    /issues:\n\s+types: \[opened, edited, reopened, labeled\]/
  );
  assert.match(workflow, /issue_comment:\n\s+types: \[created\]/);
  assert.match(
    workflow,
    /if: github\.repository == 'perfect-panel\/frontend' && \(github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'pull_request_target' \|\| github\.event\.issue\.state == 'open'\)/
  );
});

test("triage workflow is skipped in forks without upstream automation secrets", () => {
  assert.match(workflow, /github\.repository == 'perfect-panel\/frontend'/);
});

test("triage workflow adds pull_request_target with only safe lifecycle types", () => {
  assert.match(
    workflow,
    /pull_request_target:\n\s+types: \[opened, edited, synchronize, reopened, ready_for_review\]/
  );
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
});

test("triage workflow checks out only the base/default branch before secrets are available", () => {
  assert.match(
    workflow,
    /uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.pull_request\.base\.ref \|\| github\.event\.repository\.default_branch \}\}/
  );
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head/);
  assert.doesNotMatch(workflow, /github\.head_ref/);
});

test("triage workflow uses automation secrets and delivery metadata, not BRIDGE secrets", () => {
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /issues: read/);
  assert.match(workflow, /pull-requests: read/);
  assert.match(
    workflow,
    /AUTOMATION_WEBHOOK_URL: \$\{\{ secrets\.AUTOMATION_WEBHOOK_URL \}\}/
  );
  assert.match(
    workflow,
    /AUTOMATION_WEBHOOK_SECRET: \$\{\{ secrets\.AUTOMATION_WEBHOOK_SECRET \}\}/
  );
  assert.match(workflow, /AUTOMATION_EVENT_TYPE:/);
  assert.match(workflow, /AUTOMATION_DRY_RUN:/);
  assert.match(
    workflow,
    /GITHUB_DELIVERY: \$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/
  );
  assert.doesNotMatch(workflow, /BRIDGE_/);
});
