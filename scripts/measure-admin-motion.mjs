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
  assert(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
  );
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(
  artifacts && !existsSync(path.join(artifacts, "report.json")),
  "New artifact directory required"
);
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  stage: process.env.PERFORMANCE_STAGE || "unspecified",
  environment:
    "Desktop Chromium, 4x CPU throttle; local mock; not a physical phone",
  samples: [],
};
const translations = JSON.parse(
  readFileSync(
    new URL(
      "../apps/admin/public/assets/locales/en-US/dashboard.json",
      import.meta.url
    ),
    "utf8"
  )
);
const components = JSON.parse(
  readFileSync(
    new URL(
      "../apps/admin/public/assets/locales/en-US/components.json",
      import.meta.url
    ),
    "utf8"
  )
);
try {
  for (const width of [390, 1440])
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion,
      });
      let closing = false;
      const errors = [],
        writes = [];
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: "light", url: origin },
      ]);
      await context.addInitScript(() => {
        localStorage.setItem("language", "en-US");
        window.__motionMetrics = { rectangles: 0, longTasks: [], frames: [] };
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function (...args) {
          window.__motionMetrics.rectangles += 1;
          return original.apply(this, args);
        };
        new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries())
            window.__motionMetrics.longTasks.push(entry.duration);
        }).observe({ type: "longtask", buffered: false });
      });
      await context.route("**/v1/**", async (route) => {
        try {
          if (closing) return await route.abort();
          const request = route.request(),
            url = new URL(request.url());
          if (request.method() !== "GET") {
            writes.push(request.method());
            return await route.abort();
          }
          const response = await context.request.get(
            `${mock}${url.pathname}${url.search}`
          );
          if (url.pathname === "/v1/admin/user/list") {
            const body = await response.json();
            const users = Array.from({ length: 200 }, (_, i) => ({
              ...body.data.list[0],
              id: i + 7,
              auth_methods: [
                {
                  auth_type: "email",
                  auth_identifier: `performance-${i}@example.com`,
                  verified: true,
                },
              ],
            }));
            const page = Number(url.searchParams.get("page") || 1),
              size = Number(url.searchParams.get("size") || 10);
            return await route.fulfill({
              json: {
                code: 200,
                data: {
                  list: users.slice((page - 1) * size, page * size),
                  total: users.length,
                },
              },
            });
          }
          await route.fulfill({ response });
        } catch (error) {
          if (!closing) errors.push(String(error));
          await route.abort().catch(() => {
            /* Context may already be closed. */
          });
        }
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
      const measure = async (label, action) => {
        await page.evaluate(() => {
          const metrics = window.__motionMetrics;
          metrics.rectangles = 0;
          metrics.longTasks = [];
          metrics.frames = [];
          metrics.running = true;
          let last;
          const tick = (time) => {
            if (!metrics.running) return;
            if (last) metrics.frames.push(time - last);
            last = time;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const before = Object.fromEntries(
          (await cdp.send("Performance.getMetrics")).metrics.map(
            ({ name, value }) => [name, value]
          )
        );
        await action();
        await page.waitForTimeout(800);
        const after = Object.fromEntries(
          (await cdp.send("Performance.getMetrics")).metrics.map(
            ({ name, value }) => [name, value]
          )
        );
        const client = await page.evaluate(() => {
          const m = window.__motionMetrics;
          m.running = false;
          const frames = m.frames.slice().sort((a, b) => a - b);
          return {
            rectangles: m.rectangles,
            longTasks: m.longTasks.length,
            longTaskMs: m.longTasks.reduce((a, b) => a + b, 0),
            frameP95Ms: frames[Math.floor(frames.length * 0.95)] || 0,
            visibleNumbers: document.querySelectorAll(
              "[data-dashboard-animated-number]"
            ).length,
            retainedWillChange: Array.from(
              document.querySelectorAll("body *")
            ).filter((node) => getComputedStyle(node).willChange !== "auto")
              .length,
          };
        });
        report.samples.push({
          width,
          reducedMotion,
          label,
          ...client,
          scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
          layouts: after.LayoutCount - before.LayoutCount,
          styleRecalcs: after.RecalcStyleCount - before.RecalcStyleCount,
          heapMB: after.JSHeapUsedSize / 1_048_576,
        });
      };
      try {
        await page.goto(`${origin}/#/dashboard`);
        const ranking = page.locator(
          '[data-dashboard-module="trafficRanking"]'
        );
        await ranking.locator(".dashboard-traffic-row").first().waitFor();
        await page.waitForTimeout(1500);
        for (let round = 0; round < 3; round += 1) {
          await measure(`ranking-period-${round}`, async () => {
            await ranking
              .getByRole("tab", { name: translations.yesterday, exact: true })
              .click();
            await page.waitForTimeout(120);
            await ranking
              .getByRole("tab", { name: translations.today, exact: true })
              .click();
          });
        }
        await page.goto(`${origin}/#/dashboard/user?size=100`);
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        await page.waitForTimeout(700);
        const count = await page
          .locator(
            width < 1280
              ? ".admin-pro-table-card"
              : 'tbody [data-slot="table-row"]'
          )
          .count();
        assert(count === 100, "Measure the real maximum supported page size");
        for (let round = 0; round < 3; round += 1) {
          await measure(`table-refresh-100-${round}`, async () => {
            await page
              .getByRole("button", {
                name: components.table.refresh,
                exact: true,
              })
              .first()
              .click();
            await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
          });
        }
        assert(errors.length === 0, JSON.stringify(errors));
        assert(writes.length === 0, JSON.stringify(writes));
        console.log(`${width}/${reducedMotion}: measured`);
      } finally {
        closing = true;
        await context.close();
      }
    }
} finally {
  await browser.close();
  writeFileSync(
    path.join(artifacts, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
