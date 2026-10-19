import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const address of [origin, mock]) {
  const url = new URL(address);
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Loopback fixtures only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(!existsSync(path.join(artifacts, "report.json")), "Preserve previous evidence");
  mkdirSync(artifacts, { recursive: true });
}
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { browser: browser.version(), scope: "Local GET fixtures. Every write is fulfilled inside Playwright; no write is forwarded to any server. Not real-backend or physical-phone verification.", cases: [] };
const resources = [
  { resource: "user", route: "user", field: "enable", label: "enable", write: "/v1/admin/user/basic" },
  { resource: "product", api: "subscribe", route: "product", field: "show", label: "show" },
  { resource: "coupon", route: "coupon", field: "enable", label: "enable" },
  { resource: "ads", route: "ads", field: "status", label: "status" },
  { resource: "announcement", route: "announcement", field: "show", label: "show" },
  { resource: "document", route: "document", field: "show", label: "show" },
];

async function run(config, width, kind = "switch") {
  const language = width < 1000 ? "en-US" : "zh-CN";
  const theme = width < 1000 ? "dark" : "light";
  const reduced = width === 768 || width === 1440;
  const result = { resource: config.resource, width, language, theme, reduced, kind, passed: false, errors: [], writes: [], frames: [] };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1024, isMobile: width < 500, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference" });
  let closing = false;
  let releaseWrite;
  let responseMode = "failure";
  let readFailures = 0;
  let slowReads = 0;
  const api = config.api || config.resource;
  const listPath = `/v1/admin/${api}/list`;
  const writePath = config.write || `/v1/admin/${api}`;
  let rows;
  const fail = (route) => route.fulfill({ status: 500, json: { code: 500, msg: "Local acceptance failure" } });
  try {
    await context.addCookies([{ name: "theme", value: theme, url: origin }, { name: "Authorization", value: "acceptance-token", url: origin }]);
    await context.addInitScript((language) => localStorage.setItem("language", language), language);
    const baseline = await context.request.get(`${mock}${listPath}`, { maxRetries: 1 });
    const base = (await baseline.json()).data?.list?.[0];
    const record = base || { id: 31, title: "Acceptance record", name: "Acceptance record", content: "Test content", type: "image", target_url: "https://example.com", tags: ["acceptance"], show: true, pinned: false, popup: false, status: 1, start_time: 1700000000000, end_time: 1900000000000, created_at: 1700000000000, updated_at: 1700000000000 };
    if (kind === "sort") {
      rows = [{ ...record, id: 42, name: "Acceptance server A", sort: 1 }, { ...record, id: 43, name: "Acceptance server B", sort: 2 }];
    } else rows = [record, { ...record, id: record.id + 1, title: "Second acceptance record", name: "Second acceptance record" }];
    await context.route("**/v1/**", async (route) => {
      try {
        if (closing) return await route.abort();
        const request = route.request(), url = new URL(request.url());
        const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/")).replace(/\/$/, "");
        if (request.method() !== "GET") {
          assert.equal(apiPath, writePath, "No unrelated writes allowed");
          result.writes.push({ method: request.method(), path: apiPath, body: request.postDataJSON() });
          await new Promise((resolve) => { releaseWrite = resolve; });
          if (closing) return await route.abort();
          if (responseMode === "failure") return await fail(route);
          const body = request.postDataJSON();
          if (kind === "sort") {
            rows = rows.map((row) => ({ ...row, sort: body.sort.find((item) => item.id === row.id)?.sort ?? row.sort })).sort((a, b) => a.sort - b.sort);
          } else if (kind === "review") rows[0].status = body.status;
          else rows[0] = { ...rows[0], [config.field]: body[config.field] };
          readFailures = kind === "sort" ? 0 : 1;
          return await route.fulfill({ json: { code: 200, data: true } });
        }
        if (apiPath === listPath) {
          if (readFailures > 0) { readFailures--; slowReads = 1; return await fail(route); }
          if (slowReads > 0) { slowReads--; await new Promise((resolve) => setTimeout(resolve, 500)); }
          return await route.fulfill({ json: { code: 200, data: { list: rows, total: rows.length } } });
        }
        await route.fulfill({ response: await context.request.get(`${mock}${apiPath}${url.search}`, { maxRetries: 1 }) });
      } catch (error) {
        if (!closing) result.errors.push(String(error));
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-10-18T08:00:00Z"));
    await page.goto(`${origin}/#/dashboard/${config.route}`);
    await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
    await page.waitForLoadState("networkidle");
    const capture = async (name) => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "No document overflow");
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `${config.resource}-${width}-${name}.png`) });
    };
    const components = locale(language, "components");
    const activate = (locator) => width < 1024 ? locator.tap() : locator.click();
    const waitForWrite = async (count) => {
      const deadline = Date.now() + 10000;
      while (result.writes.length < count || !releaseWrite) {
        assert(Date.now() < deadline, "Expected a locally intercepted write");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    const release = () => { const done = releaseWrite; releaseWrite = undefined; done(); };
    if (kind === "switch") {
      const text = locale(language, config.resource);
      const switches = page.getByRole("switch", { name: text[config.label], exact: true });
      const control = switches.first();
      const initial = await control.getAttribute("aria-checked");
      await activate(control);
      await page.waitForFunction(() => document.querySelector('[data-phase="pending"]'));
      assert.equal(await control.isDisabled(), true);
      assert.equal(await control.getAttribute("aria-checked"), initial, "No optimistic success");
      if (await switches.count() > 1) assert.equal(await switches.nth(1).isDisabled(), false, "Other record remains usable");
      await waitForWrite(1);
      assert.equal(result.writes.length, 1);
      release();
      const owner = control.locator("xpath=ancestor::*[contains(@class,'admin-async-switch')][1]");
      await owner.locator('[role="alert"]').waitFor();
      assert.equal(await control.getAttribute("aria-checked"), initial, "Failed write retains state");
      assert.equal(await control.isDisabled(), false);
      await capture("write-failed");
      responseMode = "success";
      await activate(control);
      await page.waitForFunction(() => document.querySelector('[data-phase="pending"]'));
      await waitForWrite(2);
      release();
      const retry = owner.getByRole("button", { name: components.actions.retryRefresh, exact: true });
      await retry.waitFor();
      assert.equal(await control.getAttribute("aria-checked"), initial === "true" ? "false" : "true", "Acknowledged state retained after read failure");
      assert.equal(await control.isDisabled(), true);
      await capture("saved-read-failed");
      const details = owner.locator('[data-slot="popover-trigger"]');
      if (await details.count()) {
        await activate(details);
        const explanation = page.locator('[data-slot="popover-content"]');
        await explanation.waitFor();
        assert((await explanation.innerText()).includes(components.actions.savedSyncFailed));
        const bounds = await explanation.boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width, "Explanation stays inside viewport");
        await page.keyboard.press("Escape");
        await explanation.waitFor({ state: "hidden" });
        if (config.resource === "product") {
          const title = page.locator('.admin-mobile-summary__title').first();
          assert((await title.boundingBox()).width >= 120, "Feedback leaves product title readable");
        }
      }
      await activate(retry);
      await page.waitForFunction(() => document.querySelector('[data-phase="pending"]'));
      assert.equal(await control.getAttribute("aria-checked"), initial === "true" ? "false" : "true", "Read retry retains the acknowledged value while pending");
      assert.equal(await owner.locator('button[data-action="retry-refresh"]').count(), 1, "Retry control remains mounted");
      await capture("read-retry-pending");
      await owner.locator('[role="alert"]').waitFor({ state: "hidden" });
      assert.equal(result.writes.length, 2, "Read retry never submits a third write");
      assert.equal(await control.isDisabled(), false);
      if (config.resource === "user") assert.deepEqual(Object.keys(result.writes[1].body).sort(), ["enable", "user_id"], "Do not overwrite wallets on an account toggle");
      await capture("synced");
    } else if (kind === "review") {
      const text = locale(language, "withdrawal");
      await activate(page.getByRole("button", { name: text.approve, exact: true }).first());
      const dialog = page.getByRole("alertdialog");
      const confirm = dialog.locator(".admin-confirm-action");
      await page.waitForTimeout(350);
      const before = await confirm.boundingBox();
      await activate(confirm);
      await page.waitForFunction(() => document.querySelector('.admin-confirm-action[data-status="loading"]'));
      await page.waitForTimeout(180);
      const pending = await confirm.boundingBox();
      result.frames.push({ before, pending, status: await confirm.getAttribute("data-visual-status") });
      assert(Math.abs(before.width - pending.width) <= 1, "Loading does not resize confirmation");
      assert.equal(await confirm.isDisabled(), true);
      await capture("review-pending");
      await waitForWrite(1);
      release();
      await dialog.getByRole("alert").waitFor();
      assert.equal(await dialog.isVisible(), true, "Failed review must stay open");
      assert.equal(await page.locator('[data-status="success"]').count(), 0, "No false success tick");
      await capture("review-failed");
      responseMode = "success";
      await activate(confirm);
      await page.waitForFunction(() => document.querySelector('.admin-confirm-action[data-status="loading"]'));
      await waitForWrite(2);
      release();
      const retry = page.getByRole("button", { name: text.retryRefresh, exact: true }).first();
      await retry.waitFor();
      assert.equal(await dialog.count(), 0);
      await capture("review-saved-read-failed");
      await activate(retry);
      await retry.waitFor({ state: "hidden" });
      assert.equal(result.writes.length, 2, "Review is never repeated after confirmed write");
    } else {
      const startSort = async () => {
        const handle = page.locator('[aria-roledescription="sortable"]').filter({ visible: true }).first();
        await handle.scrollIntoViewIfNeeded();
        await handle.focus();
        await page.keyboard.press("Space");
        await page.waitForTimeout(80);
        await page.keyboard.press("ArrowDown");
        // Keyboard sorting may first smoothly scroll the next mobile card into view.
        // Drop only after DndKit confirms the intended target, not after an arbitrary timer.
        await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((node) => node.textContent.includes("over droppable area 43")), undefined, { timeout: 5000 });
        await page.keyboard.press("Space");
        await page.locator('[data-sort-pending="true"]').waitFor();
      };
      await startSort();
      await waitForWrite(1);
      assert.equal(result.writes.length, 1);
      release();
      await page.getByRole("alert").filter({ hasText: components.table.sortFailed }).waitFor();
      await capture("sort-failed");
      responseMode = "success";
      await startSort();
      await waitForWrite(2);
      release();
      await page.locator('[data-sort-pending="true"]').waitFor({ state: "hidden" });
      assert.equal(result.writes.length, 2);
      await capture("sort-saved");
    }
    assert.equal(result.errors.length, 0, result.errors.join("\n"));
    result.passed = true;
  } catch (error) {
    result.errors.push(error.stack || String(error));
    const failedPage = context.pages()[0];
    if (failedPage && artifacts) {
      await failedPage.screenshot({ path: path.join(artifacts, `${config.resource}-${width}-failed.png`) }).catch(() => {});
      result.failureBody = await failedPage.locator("body").innerText().catch(() => "");
    }
  }
  finally { closing = true; releaseWrite?.(); await context.close(); console.log(JSON.stringify({ resource: config.resource, width, kind, passed: result.passed, errors: result.errors })); }
}

try {
  const widths = (process.env.ACCEPTANCE_WIDTHS || "390,1440").split(",").map(Number);
  const selected = process.env.ACCEPTANCE_RESOURCES?.split(",");
  for (const width of widths) {
    for (const resource of resources.filter((item) => !selected || selected.includes(item.resource))) await run(resource, width);
    if (!selected || selected.includes("withdrawal")) await run({ resource: "withdrawal", route: "withdrawal", write: "/v1/admin/withdrawal/status" }, width, "review");
    if (!selected || selected.includes("server")) await run({ resource: "server", route: "servers", write: "/v1/admin/server/server/sort" }, width, "sort");
  }
} finally { await browser.close(); if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2)); }
assert(report.cases.every((item) => item.passed), "See operation-feedback report for failures");
