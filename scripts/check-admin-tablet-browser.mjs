import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

// Optional production-preview regression, local mock only. Never uses live data.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const url of [origin, mock])
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname));
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(
    !existsSync(path.join(artifacts, "report.json")),
    "Preserve existing evidence"
  );
  mkdirSync(artifacts, { recursive: true });
}
const widths = process.env.ACCEPTANCE_WIDTHS?.split(",").map(Number) || [
  390, 430, 768, 834, 1024, 1194, 1280, 1440,
];
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const report = {
  backend: "Local mock only; reorder writes target the mock",
  cases: [],
};
try {
  for (const width of widths) {
    for (const [language, theme] of [
      ["en-US", "light"],
      ["zh-CN", "dark"],
    ]) {
      await test(`Tablet layouts ${width}px ${language} ${theme}`, async () => {
        const result = {
          width,
          language,
          theme,
          passed: false,
          errors: [],
          failedRequests: [],
        };
        report.cases.push(result);
        const context = await browser.newContext({
          viewport: {
            width,
            height: width >= 1024 && width < 1280 ? 768 : 1024,
          },
          hasTouch: width < 1280,
          isMobile: width < 500,
          reducedMotion: theme === "dark" ? "reduce" : "no-preference",
        });
        let closing = false;
        const errors = result.errors;
        const sortRequests = [];
        const pendingRequests = new Set();
        let listMode = "normal";
        let releaseList;
        try {
          await context.addCookies([
            { name: "Authorization", value: "acceptance-token", url: origin },
            { name: "theme", value: theme, url: origin },
          ]);
          await context.addInitScript((locale) => {
            if (location.protocol === "http:")
              localStorage.setItem("language", locale);
          }, language);
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(error.message));
          await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
          page.on("request", (request) => pendingRequests.add(request));
          page.on("requestfinished", (request) =>
            pendingRequests.delete(request)
          );
          page.on("requestfailed", (request) => {
            pendingRequests.delete(request);
            result.failedRequests.push({
              url: request.url(),
              error: request.failure()?.errorText,
            });
          });
          await page.route("**/v1/**", async (route) => {
            try {
              if (closing) return await route.abort();
              const url = new URL(route.request().url());
              const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
              if (apiPath === "/v1/admin/order/list" && listMode !== "normal") {
                if (listMode === "loading")
                  await new Promise((resolve) => {
                    releaseList = resolve;
                  });
                return await route.fulfill({
                  json:
                    listMode === "error"
                      ? { code: 500, msg: "Tablet acceptance unavailable" }
                      : { code: 200, data: { list: [], total: 0 } },
                });
              }
              if (/sort/.test(apiPath) && route.request().method() === "POST")
                sortRequests.push(route.request().postDataJSON());
              const response = await context.request.fetch(
                `${mock}${apiPath}${url.search}`,
                {
                  method: route.request().method(),
                  data: route.request().postData() || undefined,
                  timeout: 10_000,
                  // A stale keep-alive connection can reset in the local fixture.
                  // Only replay reads; never retry a reorder/business write.
                  maxRetries: route.request().method() === "GET" ? 1 : 0,
                }
              );
              // At least two records are necessary to prove real two-column geometry.
              if (/\/admin\/(order|coupon|payment)\/list$/.test(apiPath)) {
                const body = await response.json();
                if (body.data?.list?.length === 1) {
                  body.data.list.push({
                    ...body.data.list[0],
                    id: body.data.list[0].id + 1000,
                  });
                  body.data.total = 2;
                }
                return await route.fulfill({ json: body });
              }
              await route.fulfill({ response });
            } catch (error) {
              if (!closing) errors.push(`Mock route: ${error}`);
              await route.abort().catch(() => {});
            }
          });
          const screenshot = async (name) => {
            if (artifacts)
              await page.screenshot({
                path: path.join(
                  artifacts,
                  `${name}-${width}-${language}-${theme}.png`
                ),
                animations: "disabled",
              });
          };
          const assertLayout = async (policy) => {
            const table = page.locator(".admin-pro-table").first();
            await table
              .locator(".admin-pro-table-card")
              .first()
              .waitFor({ state: "attached" });
            await page.waitForFunction(
              () =>
                document
                  .querySelector(".admin-pro-table")
                  ?.getAttribute("aria-busy") === "false"
            );
            const geometry = await table.evaluate((el) => {
              const cards = el.querySelector(".admin-pro-table-mobile");
              return {
                width: el.clientWidth,
                layout: el.getAttribute("data-tablet-layout"),
                columns:
                  getComputedStyle(cards).gridTemplateColumns.split(" ").length,
                cardsVisible: getComputedStyle(cards).display !== "none",
                tableVisible:
                  getComputedStyle(el.querySelector(".admin-pro-table-desktop"))
                    .display !== "none",
                overflow:
                  document.documentElement.scrollWidth - window.innerWidth,
              };
            });
            assert.equal(geometry.layout, policy);
            assert.equal(geometry.cardsVisible, width < 1280);
            assert.equal(geometry.tableVisible, width >= 1280);
            assert(
              geometry.overflow <= 1,
              `page overflow ${geometry.overflow}`
            );
            if (width < 1280) {
              const overflowFields = await table
                .locator(".admin-pro-table-mobile .admin-mobile-summary__value")
                .evaluateAll((fields) =>
                  fields
                    .filter(
                      (el) =>
                        el.clientWidth > 0 &&
                        el.scrollWidth > el.clientWidth + 1
                    )
                    .map((el) => el.textContent)
                );
              assert.deepEqual(
                overflowFields,
                [],
                "card values must not overlap neighbouring fields"
              );
            }
            if (width < 1280)
              assert.equal(
                geometry.columns,
                policy === "grid" && width >= 768 && geometry.width >= 680
                  ? 2
                  : 1,
                `${page.url()} ${JSON.stringify(geometry)}`
              );
            return table;
          };
          for (const [route, policy] of [
            ["servers", "list"],
            ["nodes", "list"],
            ["user", "list"],
            ["product", "list"],
            ["order", "grid"],
            ["coupon", "grid"],
            ["payment", "grid"],
            ["ticket", "list"],
            ["log/subscribe", "list"],
          ]) {
            await page.goto("about:blank");
            await page.goto(`${origin}/#/dashboard/${route}`);
            const table = await assertLayout(policy);
            if (width >= 768 && width < 1280) {
              if (
                route === "user" ||
                route === "servers" ||
                route === "nodes"
              ) {
                const summary = table
                  .locator(
                    `[class*="admin-tablet-${route === "servers" ? "server" : route === "nodes" ? "node" : "user"}-summary"]`
                  )
                  .first();
                if (await table.evaluate((el) => el.clientWidth >= 680))
                  assert.equal(
                    await summary.evaluate(
                      (el) => getComputedStyle(el).display
                    ),
                    "grid"
                  );
              }
              if (policy === "grid" && width >= 1024) {
                // Open/collapsed Sidebar must both recompute using usable width.
                await page.locator('[data-slot="sidebar-trigger"]').click();
                await assertLayout(policy);
                await page.locator('[data-slot="sidebar-trigger"]').click();
                await assertLayout(policy);
              }
              if (route === "nodes") {
                // Keyboard reorder uses the same vertical strategy in tablet mode.
                const drag = table
                  .locator(
                    ".admin-pro-table-mobile button[aria-roledescription]"
                  )
                  .first();
                await drag.focus();
                await page.keyboard.press("Space");
                await table.locator('[data-dragging="true"]').waitFor();
                // DndKit attaches keyboard listeners in the next task and measures
                // droppables on the next layout frame after drag activation.
                await page.evaluate(
                  () =>
                    new Promise((resolve) =>
                      requestAnimationFrame(() =>
                        requestAnimationFrame(resolve)
                      )
                    )
                );
                await page.keyboard.press("ArrowDown");
                // A short landscape viewport needs DndKit to scroll to the next
                // row first. Drop only once its live region confirms that target.
                await page.waitForFunction(() =>
                  [
                    ...document.querySelectorAll('[aria-live="assertive"]'),
                  ].some((el) => el.textContent.includes("droppable area 85"))
                );
                const sorted = page.waitForResponse(
                  (response) =>
                    /sort/.test(response.url()) &&
                    response.request().method() === "POST"
                );
                await page.keyboard.press("Space");
                await sorted;
                await page.waitForFunction(() =>
                  document.querySelector('[aria-busy="false"].admin-pro-table')
                );
                // Actual sort call is asserted below, not only a visual movement.
                const checkbox = table
                  .locator('.admin-pro-table-mobile [role="checkbox"]')
                  .first();
                const box = await checkbox.boundingBox();
                assert(
                  box.width <= 24 && box.height <= 24,
                  "compact selection must not become a giant checkbox"
                );
                await checkbox.click();
                const batch = page.locator(".admin-batch-actions");
                await batch.waitFor();
                await page.evaluate(() =>
                  window.scrollTo(0, document.body.scrollHeight)
                );
                const bar = await batch.boundingBox();
                assert(
                  bar.y >= 0 &&
                    bar.y + bar.height <= page.viewportSize().height,
                  "batch actions stay inside viewport"
                );
                await batch.getByRole("button").last().click();
                await page.evaluate(() => window.scrollTo(0, 0));
              }
            }
            await screenshot(route.replaceAll("/", "-"));
          }
          if (width >= 768 && width < 1280)
            assert(sortRequests.length > 0, "tablet reorder must save");
          if (width >= 768 && width < 1280) {
            // Empty/error feedback spans the whole grid, not half a card column.
            for (const state of ["loading", "error", "empty"]) {
              listMode = state;
              await page.goto("about:blank");
              await page.goto(`${origin}/#/dashboard/order`);
              const grid = page.locator(".admin-pro-table-mobile");
              if (state === "loading") {
                await grid
                  .locator(".admin-pro-table-placeholder")
                  .first()
                  .waitFor();
                await screenshot("order-loading");
                releaseList();
                await grid
                  .locator(".admin-pro-table-placeholder")
                  .first()
                  .waitFor({ state: "detached" });
              } else {
                const feedback = grid.locator(
                  state === "error" ? '[role="alert"]' : ".col-span-full"
                );
                await feedback.waitFor();
                const parent = await grid.boundingBox(),
                  child = await feedback.boundingBox();
                assert(
                  Math.abs(parent.width - child.width) <= 2,
                  "state must span both columns"
                );
                await screenshot(`order-${state}`);
              }
            }
            listMode = "normal";
          }
          // Tablet workspace uses two ordered field columns and a visible footer.
          await page.goto(`${origin}/#/dashboard/servers/new`);
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          const name = dialog.locator('[data-form-field="name"]');
          const address = dialog.locator('[data-form-field="address"]');
          await name.waitFor();
          if (width >= 768 && width < 1280) {
            const a = await name.boundingBox(),
              b = await address.boundingBox();
            assert(
              Math.abs(a.y - b.y) < 2 && b.x > a.x,
              "server basic fields should use two columns"
            );
            assert(
              a.width > 250 && b.width > 250,
              "tablet inputs need readable width"
            );
            const footer = await dialog
              .locator(".admin-workspace-dialog__footer")
              .boundingBox();
            assert(
              footer.y + footer.height <= page.viewportSize().height + 1,
              "save footer must remain visible"
            );
          }
          await screenshot("server-form");
          assert.deepEqual(errors, []);
          result.passed = true;
          result.sortRequests = sortRequests.length;
        } catch (error) {
          result.failure = String(error);
          result.url = context.pages()[0]?.url();
          result.pendingRequests = Array.from(pendingRequests, (request) =>
            request.url()
          );
          if (artifacts)
            await context.pages()[0]?.screenshot({
              path: path.join(artifacts, `failure-${width}-${language}.png`),
            });
          console.error(error);
          throw error;
        } finally {
          releaseList?.();
          closing = true;
          await context.close();
        }
      });
    }
  }
} finally {
  await browser.close();
  if (artifacts)
    writeFileSync(
      path.join(artifacts, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
}
