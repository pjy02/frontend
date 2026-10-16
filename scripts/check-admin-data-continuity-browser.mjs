import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const value of [origin, mock]) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Local mock/preview only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts && existsSync(path.join(artifacts, "report.json")))
  throw new Error("Preserve existing report; choose a new directory");
if (artifacts) mkdirSync(artifacts, { recursive: true });
const locale = (language, namespace) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../apps/admin/public/assets/locales/${language}/${namespace}.json`,
        import.meta.url
      ),
      "utf8"
    )
  );
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440")
  .split(",")
  .map(Number);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const report = { backend: "local mock only; all writes blocked", cases: [] };
try {
  for (const width of widths)
    for (const [language, theme, reducedMotion] of [
      ["en-US", "light", "no-preference"],
      ["zh-CN", "dark", "reduce"],
    ]) {
      const id = `${width}-${language}-${theme}`;
      const result = {
        id,
        passed: false,
        errors: [],
        writes: [],
        evidence: [],
      };
      report.cases.push(result);
      const context = await browser.newContext({
        viewport: { width, height: width < 500 ? 844 : 900 },
        hasTouch: width < 1024,
        isMobile: width < 500,
        reducedMotion,
      });
      let releaseEmails;
      const emailGate = new Promise((resolve) => {
        releaseEmails = resolve;
      });
      let tableFailed = false,
        tableDelay = false,
        dashboardFailed = false,
        dashboardEmpty = false,
        closing = false;
      try {
        await context.addCookies([
          { name: "Authorization", value: "acceptance-token", url: origin },
          { name: "theme", value: theme, url: origin },
        ]);
        await context.addInitScript((language) => {
          if (location.protocol === "http:")
            localStorage.setItem("language", language);
        }, language);
        await context.route("**/v1/**", async (route) => {
          try {
            if (closing) return await route.abort();
            const request = route.request(),
              url = new URL(request.url());
            const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
            if (request.method() !== "GET") {
              result.writes.push(`${request.method()} ${apiPath}`);
              return await route.abort();
            }
            if (apiPath === "/v1/admin/user/detail") await emailGate;
            if (
              dashboardFailed &&
              /^\/v1\/admin\/console\/(server|revenue)$/.test(apiPath)
            )
              return await route.fulfill({
                status: 500,
                json: { code: 500, message: "Intentional dashboard failure" },
              });
            if (apiPath === "/v1/admin/user/list" && tableFailed)
              return await route.fulfill({
                status: 500,
                json: { code: 500, message: "Intentional mock failure" },
              });
            if (apiPath === "/v1/admin/user/list" && tableDelay)
              await new Promise((resolve) => setTimeout(resolve, 650));
            const response = await context.request.get(
              `${mock}${apiPath}${url.search}`
            );
            if (/^\/v1\/admin\/console\/(revenue|user)$/.test(apiPath)) {
              const fixture = await response.json();
              // Explicit valid all-time series for range continuity, rather
              // than pretending the general mock's aggregate contains points.
              fixture.data.all.list = fixture.data.monthly.list
                .slice(0, 3)
                .map((item, index) => ({
                  ...item,
                  date: `2026-0${index + 6}-01`,
                }));
              return await route.fulfill({ json: fixture });
            }
            if (apiPath === "/v1/admin/console/server" && dashboardEmpty) {
              const fixture = await response.json();
              for (const key of [
                "server_traffic_ranking_today",
                "server_traffic_ranking_yesterday",
                "user_traffic_ranking_today",
                "user_traffic_ranking_yesterday",
              ])
                fixture.data[key] = [];
              return await route.fulfill({ json: fixture });
            }
            if (apiPath === "/v1/admin/user/list") {
              const fixture = await response.json();
              const page = Number(url.searchParams.get("page") || 1),
                size = Number(url.searchParams.get("size") || 10);
              const all = Array.from({ length: 30 }, (_, index) => ({
                ...fixture.data.list[0],
                id: index + 7,
                auth_methods: [
                  {
                    auth_type: "email",
                    auth_identifier: `operator-${index + 7}@example.com`,
                    verified: true,
                  },
                ],
              }));
              return await route.fulfill({
                json: {
                  code: 200,
                  data: {
                    list: all.slice((page - 1) * size, page * size),
                    total: all.length,
                  },
                },
              });
            }
            await route.fulfill({ response });
          } catch (error) {
            if (!closing) throw error;
          }
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => result.errors.push(error.message));
        await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
        const d = locale(language, "dashboard"),
          c = locale(language, "components"),
          u = locale(language, "user");
        const screenshot = async (name) => {
          await page.waitForTimeout(350);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1
            ),
            false,
            `${name}: viewport overflow`
          );
          if (artifacts)
            await page.screenshot({
              path: path.join(artifacts, `${id}-${name}.png`),
              animations: "allow",
            });
          result.evidence.push(name);
        };
        await page.goto(`${origin}/#/dashboard`);
        const ranking = page.locator(
          '[data-dashboard-module="trafficRanking"]'
        );
        await ranking.locator(".dashboard-traffic-row").first().waitFor();
        await page.waitForTimeout(750);
        const controls = await ranking
          .locator(".dashboard-traffic-controls")
          .elementHandle();
        const system = await ranking
          .locator(".dashboard-traffic-summary > div")
          .first()
          .elementHandle();
        const node = await ranking
          .locator('[data-traffic-id="nodes-42"]')
          .elementHandle();
        const bar = await ranking
          .locator('[data-traffic-id="nodes-42"] .dashboard-traffic-bar')
          .elementHandle();
        await ranking
          .getByRole("tab", { name: d.yesterday, exact: true })
          .click();
        assert(
          await node.evaluate(
            (element) =>
              document.querySelector('[data-traffic-id="nodes-42"]') === element
          ),
          "period keeps entity DOM"
        );
        assert(
          await bar.evaluate((element) => element.isConnected),
          "period keeps bar DOM"
        );
        assert(
          Math.abs(
            (await bar.evaluate(
              (element) => new DOMMatrix(getComputedStyle(element).transform).a
            )) - 1
          ) < 0.01,
          "period never resets the bar to its entry scale"
        );
        await page.waitForTimeout(350);
        await ranking.getByRole("tab", { name: d.today, exact: true }).click();
        await ranking.getByRole("tab", { name: d.users, exact: true }).click();
        if (reducedMotion !== "reduce") {
          const opacity = await ranking
            .locator("[data-dashboard-fade-through]")
            .evaluateAll((elements) =>
              elements.map((element) =>
                Number(getComputedStyle(element).opacity)
              )
            );
          assert(
            Math.max(...opacity) - Math.min(...opacity) < 0.02,
            "category-dependent regions share a clock"
          );
        }
        await ranking.locator('[data-traffic-id="users-101"]').waitFor();
        if (width >= 1024) {
          await ranking
            .locator('[data-traffic-id="users-102"]')
            .scrollIntoViewIfNeeded();
          await page.waitForTimeout(350);
        }
        // Radix TooltipTrigger may render the button without a wrapper.
        const trafficTrigger = ranking
          .locator('[data-traffic-id="users-101"] button')
          .first();
        await trafficTrigger.scrollIntoViewIfNeeded();
        if (width < 1024) await trafficTrigger.tap();
        else await trafficTrigger.hover();
        const detail =
          width < 1024
            ? page.getByRole("dialog")
            : page
                .locator('[data-slot="tooltip-content"]')
                .filter({ visible: true })
                .first();
        await detail.waitFor();
        const detailNode = await detail
          .locator(".dashboard-traffic-tooltip__data")
          .first()
          .elementHandle();
        const detailBar = await detail
          .locator(".dashboard-traffic-tooltip-bar")
          .first()
          .elementHandle();
        releaseEmails();
        await detail
          .getByText("mobile.acceptance@example.com", { exact: true })
          .first()
          .waitFor();
        assert(
          await detailNode.evaluate((element) => element.isConnected),
          "email preserves detail DOM"
        );
        assert(
          await detailBar.evaluate((element) => element.isConnected),
          "email preserves comparison bar DOM"
        );
        await screenshot("traffic-detail");
        if (width >= 1024) {
          const nextTrigger = ranking
            .locator('[data-traffic-id="users-102"] button')
            .first();
          const nextBox = await nextTrigger.boundingBox();
          assert(nextBox);
          // Real pointer travel emits multiple moves. A single synthetic hover
          // can stop inside Radix's previous hover-grace region before it clears.
          await page.mouse.move(
            nextBox.x + 15,
            nextBox.y + nextBox.height / 2,
            { steps: 12 }
          );
          await page.mouse.move(
            nextBox.x + 25,
            nextBox.y + nextBox.height / 2,
            { steps: 3 }
          );
          const continued = page
            .locator('[data-slot="tooltip-content"][data-state="instant-open"]')
            .first();
          await continued.waitFor();
          assert.equal(
            await continued.evaluate(
              (element) => getComputedStyle(element).animationName
            ),
            "none",
            "continuous pointer moves do not replay tooltip entrance"
          );
        }
        await page.keyboard.press("Escape");
        if (width >= 1024) await page.mouse.move(0, 0);
        await ranking.getByRole("tab", { name: d.nodes, exact: true }).click();
        await ranking.getByRole("tab", { name: d.users, exact: true }).click();
        await ranking.getByRole("tab", { name: d.nodes, exact: true }).click();
        await ranking.locator('[data-traffic-id="nodes-42"]').waitFor();
        await page.waitForTimeout(450);
        assert.equal(
          await ranking
            .locator('[data-dashboard-transition-key="users"]')
            .count(),
          0,
          "no queued outgoing panels"
        );
        assert(
          await controls.evaluate((element) => element.isConnected),
          "controls stay mounted"
        );
        assert(
          await system.evaluate(
            (element) =>
              element.isConnected && getComputedStyle(element).opacity === "1"
          ),
          "system total stays mounted and opaque"
        );
        await screenshot("ranking");
        const chartModule = page.locator(
          '[data-dashboard-module="revenueTrend"]'
        );
        const legend = chartModule
          .locator("[data-dashboard-chart-legend] button")
          .first();
        await legend.click();
        assert.equal(await legend.getAttribute("aria-pressed"), "false");
        const chart = await chartModule
          .locator('[data-slot="chart"]')
          .elementHandle();
        await page.getByRole("tab", { name: d.total, exact: true }).click();
        assert(
          await chart.evaluate((element) => element.isConnected),
          "range keeps chart mounted"
        );
        await chartModule
          .getByRole("button", { name: d.overview.expandChart })
          .click();
        const expanded = page.getByRole("dialog");
        await expanded.waitFor();
        const expandedLegend = expanded
          .locator("[data-dashboard-chart-legend] button")
          .first();
        assert.equal(
          await expandedLegend.getAttribute("aria-pressed"),
          "false",
          "expanded view retains series visibility"
        );
        await expandedLegend.click();
        assert.equal(
          await legend.getAttribute("aria-pressed"),
          "true",
          "expanded legend updates inline view"
        );
        await screenshot("expanded-chart");
        await page.keyboard.press("Escape");
        const retainedRow = await ranking
          .locator('[data-traffic-id="nodes-42"]')
          .elementHandle();
        dashboardFailed = true;
        await page
          .getByRole("button", { name: d.overview.refresh, exact: true })
          .click();
        await ranking.locator('[data-freshness="stale"]').waitFor();
        assert(
          await retainedRow.evaluate((element) => element.isConnected),
          "failed dashboard refresh retains ranking rows"
        );
        assert(
          await chart.evaluate((element) => element.isConnected),
          "failed dashboard refresh retains chart"
        );
        await screenshot("dashboard-stale");
        dashboardFailed = false;
        dashboardEmpty = true;
        await page
          .getByRole("button", { name: d.overview.refresh, exact: true })
          .click();
        await ranking.getByText(d.freshness.empty, { exact: true }).waitFor();
        assert.equal(
          await ranking.locator(".dashboard-traffic-row").count(),
          0
        );
        await screenshot("ranking-empty");
        dashboardEmpty = false;
        await page.goto(`${origin}/#/dashboard/user`);
        const table = page.locator(".admin-pro-table");
        await table
          .locator('tbody tr[data-slot="table-row"]')
          .first()
          .waitFor({ state: "attached" });
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const body = await table.locator("tbody").elementHandle(),
          cards = await table
            .locator(".admin-pro-table-mobile")
            .elementHandle();
        const row = await table
          .locator('tbody tr[data-slot="table-row"]')
          .first()
          .elementHandle();
        tableDelay = true;
        await page
          .getByRole("button", { name: c.table.refresh, exact: true })
          .click();
        await page.locator('.admin-pro-table[aria-busy="true"]').waitFor();
        assert(
          await row.evaluate((element) => element.isConnected),
          "refresh keeps old row while pending"
        );
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        assert(
          await row.evaluate((element) => element.isConnected),
          "refresh keeps row DOM after success"
        );
        assert.equal(await table.locator("[data-feedback]").count(), 0);
        tableDelay = false;
        tableFailed = true;
        await page
          .getByRole("button", { name: c.table.refresh, exact: true })
          .click();
        await page.locator(".admin-pro-table-stale-alert").waitFor();
        assert(
          await row.evaluate((element) => element.isConnected),
          "failed refresh retains old row"
        );
        tableFailed = false;
        await page
          .getByRole("button", { name: c.pagination.next, exact: true })
          .click();
        await page.waitForFunction(() =>
          document.querySelector(
            '.admin-pro-table[data-operation="pagination"][aria-busy="false"]'
          )
        );
        assert(
          await body.evaluate((element) => element.isConnected),
          "page keeps result body"
        );
        assert(
          await cards.evaluate((element) => element.isConnected),
          "page keeps mobile region"
        );
        assert.equal(
          await table.locator("[data-feedback]").count(),
          0,
          "page results are not new rows"
        );
        await screenshot("table-page");
        const rows = table.locator(
          width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop"
        );
        await rows
          .getByRole("button", { name: u.edit, exact: true })
          .first()
          .click();
        await page.getByRole("dialog").waitFor();
        const input = page
          .getByRole("dialog")
          .getByRole("textbox", { name: u.referralCode, exact: true });
        await input.fill("KEEP-CONTINUITY");
        const dialog = await page.getByRole("dialog").elementHandle();
        // Drive the real toolbar handler programmatically while the modal owns
        // pointer focus, simulating an independent background table refresh.
        const refreshed = page.waitForResponse((response) =>
          response.url().includes("/v1/admin/user/list")
        );
        await table
          .getByRole("button", {
            name: c.table.refresh,
            exact: true,
            includeHidden: true,
          })
          .evaluate((element) => element.click());
        await refreshed;
        await page
          .locator('.admin-pro-table[aria-busy="false"]')
          .waitFor({ state: "attached" });
        assert(await dialog.evaluate((element) => element.isConnected));
        assert.equal(await input.inputValue(), "KEEP-CONTINUITY");
        await screenshot("row-workspace");
        assert.deepEqual(result.errors, []);
        assert.deepEqual(result.writes, []);
        result.passed = true;
        console.log(`PASS ${id}`);
      } catch (error) {
        result.failure = error.stack;
        console.error(`FAIL ${id}: ${error.message}`);
        if (artifacts)
          await context
            .pages()[0]
            ?.screenshot({ path: path.join(artifacts, `${id}-failure.png`) })
            .catch(() => {
              /* Preserve original failure. */
            });
      } finally {
        releaseEmails();
        closing = true;
        await context.close();
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
if (report.cases.some((result) => !result.passed)) process.exitCode = 1;
