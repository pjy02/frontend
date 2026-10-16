import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

// Optional acceptance runner. Only local preview and fixtures are allowed.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mockOrigin = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const url of [origin, mockOrigin])
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname));
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const widths = process.env.ACCEPTANCE_WIDTHS
  ? process.env.ACCEPTANCE_WIDTHS.split(",").map(Number)
  : [390, 430, 768, 1024, 1280, 1440];
try {
  for (const width of widths)
    for (const [language, theme] of [
      ["en-US", "light"],
      ["zh-CN", "dark"],
    ]) {
      await test(`Admin personalization ${width}px ${language} ${theme}`, async () => {
        const dashboard = JSON.parse(
          readFileSync(
            new URL(
              `../apps/admin/public/assets/locales/${language}/dashboard.json`,
              import.meta.url
            ),
            "utf8"
          )
        );
        const components = JSON.parse(
          readFileSync(
            new URL(
              `../apps/admin/public/assets/locales/${language}/components.json`,
              import.meta.url
            ),
            "utf8"
          )
        );
        const labels = dashboard.components,
          views = components.table.views;
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          hasTouch: width < 1024,
          isMobile: width < 500,
          reducedMotion: language === "zh-CN" ? "reduce" : "no-preference",
        });
        let closing = false;
        try {
          await context.addCookies([
            { name: "Authorization", value: "acceptance-token", url: origin },
            { name: "theme", value: theme, url: origin },
          ]);
          await context.addInitScript(
            (language) => localStorage.setItem("language", language),
            language
          );
          const page = await context.newPage();
          let account = 1;
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/v1/**", async (route) => {
            try {
              if (closing) {
                await route.abort();
                return;
              }
              const url = new URL(route.request().url());
              const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
              const response = await context.request.fetch(
                `${mockOrigin}${apiPath}${url.search}`,
                {
                  method: route.request().method(),
                  data: route.request().postData() || undefined,
                }
              );
              if (apiPath === "/v1/admin/user/current") {
                const body = await response.json();
                body.data.id = account;
                await route.fulfill({
                  contentType: "application/json",
                  body: JSON.stringify(body),
                });
              } else await route.fulfill({ response });
            } catch (error) {
              if (!closing) throw error;
            }
          });
          const url = `${origin}/#/dashboard?range=total&trafficType=users&trafficPeriod=yesterday&trafficLimit=5`;
          const openSettings = () =>
            page
              .getByRole("button", { name: labels.button, exact: true })
              .click();
          const waitDashboard = async () => {
            await page.locator(".dashboard-traffic-row").first().waitFor();
            await page
              .getByRole("button", { name: labels.button, exact: true })
              .waitFor();
          };
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
          await page.goto(url);
          await waitDashboard();
          assert.equal(
            await page.evaluate(() =>
              document.documentElement.classList.contains("dark")
            ),
            theme === "dark"
          );
          await openSettings();
          let dialog = page.getByRole("dialog");
          await dialog
            .getByRole("switch", { name: labels.modules.income, exact: true })
            .click();
          await page.waitForFunction(
            () => !document.querySelector('[data-dashboard-module="income"]')
          );
          await dialog
            .getByRole("button", {
              name: labels.moveUp.replace(
                "{{name}}",
                labels.modules.trafficRanking
              ),
              exact: true,
            })
            .click();
          const key = "ppanel.admin.dashboard.preferences.v2.1";
          const device = width < 1024 ? "mobile" : "desktop";
          const saved = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)),
            key
          );
          assert.equal(saved[device].order.indexOf("trafficRanking"), 3);
          assert(saved[device].hidden.includes("income"));
          await screenshot("settings");
          await dialog
            .getByRole("button", { name: labels.preset.minimal, exact: true })
            .click();
          assert.equal(
            await page.locator("[data-dashboard-module]").count(),
            6
          );
          await dialog
            .getByRole("button", {
              name: device === "mobile" ? labels.desktop : labels.mobile,
              exact: true,
            })
            .click();
          await dialog
            .getByRole("button", {
              name: labels.preset.infrastructure,
              exact: true,
            })
            .click();
          assert.equal(
            await page.locator("[data-dashboard-module]").count(),
            6
          );
          await dialog
            .getByRole("button", {
              name: device === "mobile" ? labels.mobile : labels.desktop,
              exact: true,
            })
            .click();
          await dialog
            .getByRole("button", { name: labels.restoreDefault, exact: true })
            .click();
          await dialog
            .getByRole("switch", { name: labels.modules.income, exact: true })
            .click();
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          await page.reload();
          await waitDashboard();
          await page.waitForFunction(
            () => !document.querySelector('[data-dashboard-module="income"]')
          );
          account = 2;
          await page.reload();
          await waitDashboard();
          await page.locator('[data-dashboard-module="income"]').waitFor();
          account = 1;
          await page.reload();
          await waitDashboard();
          await page.waitForFunction(
            () => !document.querySelector('[data-dashboard-module="income"]')
          );
          const row = page.locator(".dashboard-traffic-row").first();
          const trigger = row.getByRole("button").first();
          await trigger.scrollIntoViewIfNeeded();
          if (width < 1024) {
            const before = await page.evaluate(() => scrollY);
            await trigger.tap();
            dialog = page.getByRole("dialog");
            await dialog.waitFor();
            await dialog.getByText(/UID /).first().waitFor();
            const box = await dialog.boundingBox();
            assert(box && box.x >= -1 && box.x + box.width <= width + 1);
            const log = dialog.getByRole("link", {
              name: dashboard.overview.trafficLogs,
            });
            const href = await log.getAttribute("href");
            assert(
              href.includes("user_id=") &&
                href.includes("user_subscribe_id=") &&
                href.includes("date=")
            );
            await screenshot("traffic-detail");
            await log.tap();
            await page.waitForURL(/#\/dashboard\/log\/subscribe-traffic/);
            await page.goBack();
            await waitDashboard();
            assert(
              page.url().includes("trafficType=users") &&
                page.url().includes("trafficPeriod=yesterday") &&
                page.url().includes("trafficLimit=5") &&
                page.url().includes("range=total")
            );
            await page.waitForFunction(
              (before) => Math.abs(scrollY - before) < 60,
              before,
              { timeout: 5000 }
            );
          } else {
            await trigger.hover();
            await page.getByRole("tooltip").waitFor();
            assert.equal(await page.getByRole("dialog").count(), 0);
          }
          await screenshot("dashboard");
          await page.goto(`${origin}/#/dashboard/user?search=acceptance`);
          await page
            .locator('.admin-pro-table[data-loading="false"]')
            .waitFor();
          if (width >= 1024) {
            await page
              .getByRole("button", {
                name: components.table.columns,
                exact: true,
              })
              .click();
            const firstColumn = page.getByRole("menuitemcheckbox").first();
            await firstColumn.click();
            await page.keyboard.press("Escape");
          }
          await page
            .getByRole("button", { name: views.settings, exact: true })
            .click();
          await page
            .getByRole("button", { name: views.compact, exact: true })
            .click();
          await page
            .getByRole("textbox", { name: views.name, exact: true })
            .fill("Focus");
          await page
            .getByRole("button", { name: views.save, exact: true })
            .click();
          await page
            .getByRole("button", { name: "Focus", exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
          await page
            .getByRole("button", { name: views.resetFilters, exact: true })
            .click();
          await page.waitForURL(
            (url) => !new URLSearchParams(url.hash.split("?")[1]).has("search")
          );
          assert.equal(
            await page.locator(".admin-pro-table").getAttribute("data-density"),
            "compact"
          );
          await page
            .getByRole("button", { name: views.settings, exact: true })
            .click();
          await page
            .getByRole("button", { name: "Focus", exact: true })
            .click();
          await page.waitForURL(/search=acceptance/);
          await page.reload();
          await page
            .locator('.admin-pro-table[data-loading="false"]')
            .waitFor();
          assert.equal(
            await page.locator(".admin-pro-table").getAttribute("data-density"),
            "compact"
          );
          await page
            .getByRole("button", { name: views.settings, exact: true })
            .click();
          await screenshot("table-views");
          await page
            .getByRole("button", { name: views.restore, exact: true })
            .click();
          assert.equal(
            await page.locator(".admin-pro-table").getAttribute("data-density"),
            "comfortable"
          );
          assert(
            await page
              .getByRole("button", { name: "Focus", exact: true })
              .isVisible()
          );
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1
            )
          );
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              width,
              language,
              theme,
              accountIsolation: true,
              independentLayouts: true,
              viewPersistence: true,
              status: "passed",
            })
          );
        } catch (error) {
          console.error(error);
          throw error;
        } finally {
          closing = true;
          await context.close();
        }
      });
    }
} finally {
  await browser.close();
}
