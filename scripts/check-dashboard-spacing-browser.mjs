import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const address of [origin, mock]) {
  const url = new URL(address);
  assert(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname),
    "Local mock only"
  );
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(
  artifacts && !existsSync(path.join(artifacts, "report.json")),
  "Preserve earlier evidence"
);
mkdirSync(artifacts, { recursive: true });
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440")
  .split(",")
  .map(Number);
const languages = ["zh-CN", "en-US"];
const themes = process.env.SPACING_SMOKE ? ["light"] : ["light", "dark"];
const browser = await chromium.launch({ headless: true });
const report = {
  backend: "Local mock only; all business writes blocked",
  cases: [],
};
try {
  for (const width of widths)
    for (const language of languages)
      for (const theme of themes) {
        const result = {
          id: `${width}-${language}-${theme}`,
          passed: false,
          errors: [],
          writes: [],
          measurements: [],
        };
        report.cases.push(result);
        const context = await browser.newContext({
          viewport: { width, height: width < 500 ? 844 : 900 },
          reducedMotion: theme === "dark" ? "reduce" : "no-preference",
          hasTouch: width < 1280,
        });
        let closing = false,
          stale = false;
        const page = await context.newPage();
        page.setDefaultTimeout(12_000);
        page.on("pageerror", (error) => result.errors.push(error.message));
        try {
          await context.addCookies([
            { name: "Authorization", value: "spacing-fixture", url: origin },
            { name: "theme", value: theme, url: origin },
          ]);
          await context.addInitScript((language) => {
            if (location.protocol === "http:")
              localStorage.setItem("language", language);
          }, language);
          await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
          await context.route("**/v1/**", async (route) => {
            try {
              if (closing) return await route.abort();
              const request = route.request(),
                url = new URL(request.url());
              if (request.method() !== "GET") {
                result.writes.push(request.method());
                return await route.abort();
              }
              if (
                stale &&
                /^\/v1\/admin\/console\/(revenue|user)$/.test(url.pathname)
              )
                return await route.fulfill({
                  json: { code: 500, msg: "Spacing test refresh failure" },
                });
              const response = await context.request.get(
                `${mock}${url.pathname}${url.search}`,
                { timeout: 10_000, maxRetries: 1 }
              );
              await route.fulfill({ response });
            } catch (error) {
              if (!closing) result.errors.push(`Mock route: ${error}`);
              await route.abort().catch(() => {});
            }
          });
          const translations = JSON.parse(
            readFileSync(
              new URL(
                `../apps/admin/public/assets/locales/${language}/dashboard.json`,
                import.meta.url
              ),
              "utf8"
            )
          );
          const measure = async (state) => {
            const values = await page.evaluate(() => {
              const rect = (node) => {
                const r = node.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, height: r.height };
              };
              const trends = ["revenueTrend", "userTrend"].map((id) => {
                const module = document.querySelector(
                  `[data-dashboard-module="${id}"]`
                );
                const freshness = module.querySelector("[data-freshness]");
                const card = module.querySelector(".dashboard-card");
                const box = rect(module),
                  footer = rect(freshness),
                  surface = rect(card);
                const nextRowTop = Math.min(
                  ...Array.from(module.parentElement.children)
                    .filter((node) => node !== module)
                    .map(rect)
                    .filter((r) => r.top > box.top + 2)
                    .map((r) => r.top)
                );
                return {
                  id,
                  footerInside: box.bottom - footer.bottom,
                  cardGap: footer.top - surface.bottom,
                  nextRowGap: nextRowTop - footer.bottom,
                };
              });
              const progress = document.querySelector(
                '[data-dashboard-module="systemHealth"] [data-slot="progress"]'
              );
              const statuses = progress.parentElement.nextElementSibling;
              const telemetry = statuses.nextElementSibling;
              return {
                trends,
                healthGap: rect(statuses).top - rect(progress).bottom,
                telemetryGap: rect(telemetry).top - rect(statuses).bottom,
                overflow: document.documentElement.scrollWidth - innerWidth,
              };
            });
            result.measurements.push({ state, ...values });
            assert(values.overflow <= 1, "No viewport overflow");
            for (const trend of values.trends) {
              assert(
                trend.footerInside >= -1,
                `${trend.id}: freshness must remain inside its grid cell (${trend.footerInside}px)`
              );
              assert(
                trend.cardGap >= 6,
                `${trend.id}: chart and freshness need separation (${trend.cardGap}px)`
              );
              assert(
                trend.nextRowGap >= 12,
                `${trend.id}: next module must not cover freshness (${trend.nextRowGap}px)`
              );
            }
            assert(
              values.healthGap >= 16,
              `Availability and status cards need at least 16px (${values.healthGap}px)`
            );
            assert(
              values.telemetryGap >= 16,
              `Telemetry needs its own spacing (${values.telemetryGap}px)`
            );
          };
          const capture = async (name, module) => {
            await page
              .locator(`[data-dashboard-module="${module}"]`)
              .evaluate((node) =>
                node.scrollIntoView({ block: "center", behavior: "instant" })
              );
            await page.screenshot({
              path: path.join(artifacts, `${result.id}-${name}.png`),
              animations: "allow",
            });
          };
          await page.goto(`${origin}/#/dashboard`);
          await page
            .locator(
              '[data-dashboard-module="revenueTrend"] [data-freshness="ready"]'
            )
            .waitFor();
          await page
            .locator(
              '[data-dashboard-module="userTrend"] [data-freshness="ready"]'
            )
            .waitFor();
          await page
            .locator(
              '[data-dashboard-module="systemHealth"] [data-slot="progress"]'
            )
            .waitFor();
          await page.waitForTimeout(800);
          await measure("normal");
          await capture("trends", "userTrend");
          await capture("health", "systemHealth");
          stale = true;
          await page
            .getByRole("button", {
              name: translations.overview.refresh,
              exact: true,
            })
            .click();
          await page
            .locator(
              '[data-dashboard-module="revenueTrend"] [data-freshness="stale"]'
            )
            .waitFor();
          await page
            .locator(
              '[data-dashboard-module="userTrend"] [data-freshness="stale"]'
            )
            .waitFor();
          await page.waitForTimeout(200);
          await measure("stale-long-label");
          await capture("stale-trends", "userTrend");
          assert.deepEqual(result.errors, []);
          assert.deepEqual(result.writes, []);
          result.passed = true;
          console.log(`PASS ${result.id}`);
        } catch (error) {
          result.failure = String(error);
          console.error(`FAIL ${result.id}: ${error}`);
          await page
            .screenshot({
              path: path.join(artifacts, `${result.id}-failure.png`),
            })
            .catch(() => {});
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
assert(
  report.cases.every((result) => result.passed),
  "All dashboard spacing cases must pass"
);
