import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const address of [origin, mock])
  assert(["127.0.0.1", "localhost"].includes(new URL(address).hostname));
const output = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(output && !existsSync(path.join(output, "report.json")));
mkdirSync(output, { recursive: true });
const locale = (language) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../apps/admin/public/assets/locales/${language}/dashboard.json`,
        import.meta.url
      ),
      "utf8"
    )
  );
const report = {
  scope:
    "Local Chromium, intercepted mock only. No real backend, physical device or soft keyboard measurement.",
  cases: [],
};
const browser = await chromium.launch();
try {
  for (const width of (
    process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440"
  )
    .split(",")
    .map(Number)) {
    for (
      let variant = 0;
      variant < (process.env.DASHBOARD_SMOKE ? 1 : 4);
      variant++
    ) {
      const language = variant % 2 ? "zh-CN" : "en-US";
      const theme = variant === 1 || variant === 2 ? "dark" : "light";
      const reduced = variant >= 2;
      const touch = width < 1024 && variant % 2 === 1;
      const t = locale(language);
      const result = {
        width,
        language,
        theme,
        reduced,
        touch,
        passed: false,
        errors: [],
        maximumEmailConcurrency: 0,
        frames: [],
      };
      report.cases.push(result);
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: reduced ? "reduce" : "no-preference",
        hasTouch: touch,
      });
      let closing = false,
        mode = "normal",
        activeEmails = 0,
        completedEmails = 0;
      let ticketExtra = 0;
      let releaseInitial;
      const initialData = new Promise((resolve) => {
        releaseInitial = resolve;
      });
      const prefix = `${width}-${language}-${theme}-${reduced}`;
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: theme, url: origin },
      ]);
      await context.addInitScript(
        ({ language }) => {
          localStorage.setItem("language", language);
        },
        { language }
      );
      await context.route("**/v1/**", async (route) => {
        let email = false;
        try {
          if (closing) return await route.abort();
          const request = route.request(),
            url = new URL(request.url());
          assert(
            request.method() === "GET",
            "No business writes in visual acceptance"
          );
          if (url.pathname === "/v1/admin/console/server") await initialData;
          if (url.pathname === "/v1/admin/console/server" && mode === "error")
            return await route.fulfill({
              status: 503,
              json: { code: 503, message: "Simulated telemetry failure" },
            });
          email = url.pathname === "/v1/admin/user/detail";
          if (email) {
            activeEmails++;
            result.maximumEmailConcurrency = Math.max(
              result.maximumEmailConcurrency,
              activeEmails
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const response = await context.request.get(
            `${mock}${url.pathname}${url.search}`
          );
          if (url.pathname === "/v1/admin/server/list") {
            const body = await response.json();
            for (const server of body.data.list)
              Object.assign(server.status, { cpu: 9, mem: 45.5, disk: 100 });
            return await route.fulfill({ json: body });
          }
          if (url.pathname === "/v1/admin/ticket/detail") {
            const body = await response.json();
            body.data.follow = Array.from(
              { length: 30 + ticketExtra },
              (_, i) => ({
                id: i + 1,
                type: 1,
                from: i % 2 ? "System" : "User",
                content: `Message ${i + 1}: reading history must not jump when new messages arrive.`,
                created_at: Date.now(),
              })
            );
            return await route.fulfill({ json: body });
          }
          if (url.pathname === "/v1/admin/console/server") {
            const body = await response.json();
            Object.assign(body.data, {
              server_traffic_ranking_today: [
                {
                  server_id: 111,
                  name: "Missing comparison",
                  upload: 100,
                  download: 200,
                },
                {
                  server_id: 112,
                  name: "Zero base",
                  upload: 50,
                  download: 100,
                },
              ],
              server_traffic_ranking_yesterday: [
                { server_id: 112, name: "Zero base", upload: 0, download: 0 },
              ],
              user_traffic_ranking_today: Array.from(
                { length: 20 },
                (_, i) => ({
                  sid: 200 + i,
                  uid: 200 + i,
                  upload: 1000 - i,
                  download: 2000 - i,
                })
              ),
              user_traffic_ranking_yesterday: Array.from(
                { length: 20 },
                (_, i) => ({
                  sid: i === 0 ? 200 : 220 + i,
                  uid: i === 0 ? 200 : 220 + i,
                  upload: 100 - i,
                  download: 200 - i,
                })
              ),
            });
            if (mode === "empty")
              Object.assign(body.data, {
                online_servers: 0,
                offline_servers: 0,
                server_traffic_ranking_today: [],
                server_traffic_ranking_yesterday: [],
                user_traffic_ranking_today: [],
                user_traffic_ranking_yesterday: [],
              });
            return await route.fulfill({ json: body });
          }
          await route.fulfill({ response });
        } catch (error) {
          if (!closing) result.errors.push(String(error));
          await route.abort().catch(() => {
            /* Context may already be closed. */
          });
        } finally {
          if (email) {
            activeEmails--;
            completedEmails++;
          }
        }
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => result.errors.push(error.message));
      await page.clock.setFixedTime(new Date("2026-10-19T06:00:00Z"));
      const activate = (locator) => (touch ? locator.tap() : locator.click());
      try {
        await page.goto(`${origin}/#/dashboard`);
        const ranking = page.locator(
          '[data-dashboard-module="trafficRanking"]'
        );
        await ranking.locator('[data-slot="skeleton"]').first().waitFor();
        await page.screenshot({
          path: path.join(output, `${prefix}-loading.png`),
        });
        releaseInitial();
        await ranking.locator('[data-traffic-id="nodes-111"]').waitFor();
        assert((await ranking.innerText()).includes(t.overview.cannotCompare));
        assert(
          (await ranking.innerText()).includes(t.overview.noComparisonBase)
        );
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        );
        await page.waitForTimeout(1500);
        // Prefetch must run while the node tab is selected, not on first user click.
        for (let wait = 0; completedEmails < 39 && wait < 100; wait++)
          await page.waitForTimeout(50);
        assert(
          completedEmails >= 39,
          `Background reads completed: ${completedEmails}`
        );
        assert(
          result.maximumEmailConcurrency <= 4,
          `Unbounded prefetch: ${result.maximumEmailConcurrency}`
        );
        await ranking.scrollIntoViewIfNeeded();
        const stable = await ranking
          .locator(".dashboard-traffic-summary > div")
          .first()
          .elementHandle();
        await page.evaluate(() => {
          window.__dashboardFrames = [];
          const start = performance.now();
          const frame = () => {
            const panel = document.querySelector(
              '[data-dashboard-module="trafficRanking"] [data-dashboard-fade-through]'
            );
            window.__dashboardFrames.push({
              ms: performance.now() - start,
              opacity: panel ? Number(getComputedStyle(panel).opacity) : null,
              key: document
                .querySelector("[data-traffic-id]")
                ?.getAttribute("data-traffic-id"),
            });
            if (performance.now() - start < 900) requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        await activate(
          ranking.getByRole("tab", { name: t.users, exact: true })
        );
        await page.screenshot({
          path: path.join(output, `${prefix}-intermediate.png`),
        });
        await page.waitForTimeout(40);
        await activate(
          ranking.getByRole("tab", { name: t.nodes, exact: true })
        );
        await activate(
          ranking.getByRole("tab", { name: t.users, exact: true })
        );
        await ranking.locator('[data-traffic-id^="users-"]').first().waitFor();
        await page.waitForTimeout(1000);
        result.frames = await page.evaluate(() => window.__dashboardFrames);
        assert(
          await stable.evaluate((element) => element.isConnected),
          "Stable system total remounted"
        );
        if (!reduced)
          assert(
            result.frames.some(
              (frame) => frame.opacity > 0 && frame.opacity < 0.99
            ),
            "No actual intermediate opacity captured"
          );
        const firstRow = await ranking
          .locator('[data-traffic-id^="users-"]')
          .first()
          .elementHandle();
        await activate(
          ranking.getByRole("tab", { name: t.yesterday, exact: true })
        );
        await activate(
          ranking.getByRole("tab", { name: t.today, exact: true })
        );
        await page.waitForTimeout(500);
        // Same rows within the current period remain stable on a no-op refresh.
        const current = await ranking
          .locator('[data-traffic-id^="users-"]')
          .first()
          .elementHandle();
        await activate(
          page.getByRole("button", { name: t.overview.refresh, exact: true })
        );
        await page.locator("[data-dashboard-refresh-result]").waitFor();
        assert(
          await current.evaluate((element) => element.isConnected),
          "Refresh remounted the row"
        );
        result.previousPeriodRowRetained = await firstRow.evaluate(
          (element) => element.isConnected
        );
        assert(
          result.previousPeriodRowRetained,
          "Shared period identity was lost"
        );
        const detailTrigger = ranking
          .locator('[data-traffic-id^="users-"] button')
          .first();
        if (touch || width < 1024) {
          await activate(detailTrigger);
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          await page.waitForTimeout(300);
          const titleBounds = await dialog
            .locator('[data-slot="dialog-title"]')
            .boundingBox();
          const closeBounds = await dialog
            .locator('[data-slot="dialog-close"]')
            .boundingBox();
          assert(
            closeBounds && closeBounds.width >= 44 && closeBounds.height >= 44,
            "Close target too small"
          );
          assert(
            titleBounds &&
              titleBounds.x + titleBounds.width <= closeBounds.x + 1,
            "Title overlaps close target"
          );
          assert((await dialog.innerText()).includes("UID"));
          assert(
            (await dialog.innerText()).includes(t.overview.trafficShareScope)
          );
          await page.screenshot({
            path: path.join(output, `${prefix}-detail.png`),
          });
          if ((width === 390 || width === 768) && variant === 0) {
            await page.setViewportSize({ width, height: 480 });
            await page.waitForTimeout(100);
            const footer = await dialog
              .locator(".admin-workspace-dialog__footer")
              .boundingBox();
            result.shrunkViewport = await dialog.evaluate((element) => ({
              bounds: element.getBoundingClientRect().toJSON(),
              height: getComputedStyle(element).height,
              top: getComputedStyle(element).top,
              transform: getComputedStyle(element).transform,
              translate: getComputedStyle(element).translate,
              viewport: {
                height: visualViewport.height,
                top: visualViewport.offsetTop,
                scale: visualViewport.scale,
              },
              variable: document.documentElement.style.getPropertyValue(
                "--admin-visible-height"
              ),
              footer: element
                .querySelector(".admin-workspace-dialog__footer")
                .getBoundingClientRect()
                .toJSON(),
            }));
            assert(
              footer && footer.y + footer.height <= 481,
              "Workspace actions clipped after viewport shrink"
            );
            await page.setViewportSize({ width, height: 900 });
          }
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
        } else {
          await detailTrigger.hover();
          await page.getByRole("tooltip").waitFor();
          result.tooltipColors = await page
            .getByRole("tooltip")
            .evaluate((tooltip) => ({
              upload: getComputedStyle(
                tooltip.querySelector(
                  ".dashboard-traffic-tooltip__segment--upload"
                )
              ).backgroundColor,
              download: getComputedStyle(
                tooltip.querySelector(
                  ".dashboard-traffic-tooltip__segment--download"
                )
              ).backgroundColor,
            }));
          await page.mouse.move(0, 0);
        }
        await page.screenshot({
          path: path.join(output, `${prefix}-settled.png`),
        });
        if (width === 390 || width === 1440) {
          mode = "error";
          await activate(
            page.getByRole("button", { name: t.overview.refresh, exact: true })
          );
          await page.locator('[data-freshness="stale"]').first().waitFor();
          assert(
            (await ranking.locator('[data-traffic-id^="users-"]').count()) > 0,
            "Stale failure cleared data"
          );
          mode = "empty";
          await activate(
            page.getByRole("button", { name: t.overview.refresh, exact: true })
          );
          await page
            .getByText(t.overview.notConfigured, { exact: true })
            .waitFor();
          assert((await ranking.locator("[data-traffic-id]").count()) === 0);
          await page.screenshot({
            path: path.join(output, `${prefix}-empty.png`),
          });
          mode = "error";
          await page.reload();
          await ranking
            .getByText(t.overview.unavailable, { exact: true })
            .waitFor();
          assert((await ranking.locator("[data-traffic-id]").count()) === 0);
          await page.screenshot({
            path: path.join(output, `${prefix}-initial-error.png`),
          });
        }
        result.retainedWillChange = await page.evaluate(
          () =>
            Array.from(
              document.querySelectorAll("[data-dashboard-module] *")
            ).filter((node) => getComputedStyle(node).willChange !== "auto")
              .length
        );
        assert(
          result.retainedWillChange === 0,
          `Retained will-change: ${result.retainedWillChange}`
        );
        if ((width === 390 || width === 1440) && variant === 0) {
          await page.goto(`${origin}/#/dashboard/ticket`);
          await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
          await page
            .getByRole("button", { name: "Reply", exact: true })
            .first()
            .click();
          const conversation = page.getByRole("dialog");
          const viewport = conversation.locator(
            '[data-slot="scroll-area-viewport"]'
          );
          await viewport.waitFor();
          await page.waitForFunction(() => {
            const viewport = document.querySelector(
              '[role="dialog"] [data-slot="scroll-area-viewport"]'
            );
            return viewport && viewport.scrollTop > 100;
          });
          await viewport.evaluate((element) => {
            element.scrollTop = 50;
          });
          await page.waitForTimeout(100);
          ticketExtra++;
          const next = conversation.getByRole("button", {
            name: "New messages · jump to latest",
            exact: true,
          });
          await next.waitFor({ timeout: 12_000 });
          assert(
            Math.abs(
              (await viewport.evaluate((element) => element.scrollTop)) - 50
            ) < 2,
            "Incoming message displaced the history reader"
          );
          await next.click();
          await page.waitForTimeout(700);
          assert(
            await viewport.evaluate(
              (element) =>
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                80
            )
          );
          result.ticketHistoryPreserved = true;
          await page.screenshot({
            path: path.join(output, `${prefix}-ticket.png`),
          });
          await page.keyboard.press("Escape");
          await conversation.waitFor({ state: "hidden" });
        }
        if (variant === 0) {
          await page.goto(`${origin}/#/dashboard/servers`);
          for (const [label, value] of [
            ["CPU", 9],
            ["Memory", 45.5],
            ["Disk", 100],
          ]) {
            const progress = page
              .getByRole("progressbar", { name: label, exact: true })
              .first();
            await progress.waitFor();
            assert(
              (await progress.getAttribute("aria-valuenow")) === String(value)
            );
            await page.waitForTimeout(180);
            const ratio = await progress.evaluate((element) => {
              const track = element.getBoundingClientRect(),
                fill = element
                  .querySelector('[data-slot="progress-indicator"]')
                  .getBoundingClientRect();
              return (fill.right - track.left) / track.width;
            });
            assert(
              Math.abs(ratio * 100 - value) < 0.3,
              `${label} visual percentage ${ratio * 100} does not equal ${value}`
            );
          }
          result.exactResourceBars = true;
        }
        assert(result.errors.length === 0, JSON.stringify(result.errors));
        result.passed = true;
        console.log(`${prefix}: passed`);
      } catch (error) {
        result.failure = String(error);
        await page
          .screenshot({ path: path.join(output, `${prefix}-failure.png`) })
          .catch(() => {
            /* Preserve original failure. */
          });
        throw error;
      } finally {
        releaseInitial();
        closing = true;
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    path.join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
