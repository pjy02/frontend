import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mockOrigin = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const url of [origin, mockOrigin])
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname));
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440")
  .split(",")
  .map(Number);
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
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
try {
  for (const width of widths)
    for (const [language, theme] of [
      ["en-US", "light"],
      ["zh-CN", "dark"],
    ]) {
      await test(`Form safety and freshness ${width}px ${language} ${theme}`, async () => {
        const d = locale(language, "dashboard"),
          s = locale(language, "servers"),
          c = locale(language, "components");
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
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          let mode = "normal",
            failSave = true,
            saves = 0;
          await page.route("**/v1/**", async (route) => {
            try {
              if (closing) return await route.abort();
              const url = new URL(route.request().url());
              const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
              if (
                apiPath.startsWith("/v1/admin/console/") &&
                (mode === "all-fail" ||
                  (mode === "partial" && apiPath.endsWith("/server")))
              )
                return await route.fulfill({
                  json: { code: 500, msg: "Acceptance fixture unavailable" },
                });
              if (apiPath === "/v1/admin/server/node_config/update") {
                saves++;
                assert.equal(
                  route.request().postDataJSON().inherit_ip_strategy,
                  false
                );
                return await route.fulfill({
                  json: failSave
                    ? { code: 500, msg: "Acceptance save failure" }
                    : { code: 200, data: true },
                });
              }
              const response = await context.request.fetch(
                `${mockOrigin}${apiPath}${url.search}`,
                {
                  method: route.request().method(),
                  data: route.request().postData() || undefined,
                }
              );
              await route.fulfill({ response });
            } catch (error) {
              if (!closing) throw error;
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
          const module = (id) =>
            page.locator(`[data-dashboard-module="${id}"]`);
          const freshness = (id) =>
            module(id).locator("[data-freshness]").first();
          await page.goto(`${origin}/#/dashboard`);
          await page.waitForFunction(() =>
            document.querySelector(
              '[data-dashboard-module="trafficRanking"] [data-freshness="ready"]'
            )
          );
          const previousTraffic = await module("monthTraffic")
            .locator(".dashboard-metric__value .sr-only")
            .innerText();
          const trafficTime = await freshness("trafficRanking")
            .locator("time")
            .getAttribute("datetime");
          const revenueTime = await freshness("income")
            .locator("time")
            .getAttribute("datetime");
          mode = "partial";
          await page
            .getByRole("button", { name: d.overview.refresh, exact: true })
            .click();
          await page.waitForFunction(
            () =>
              document.querySelector(
                '[data-dashboard-module="trafficRanking"] [data-freshness="stale"]'
              ),
            { timeout: 30_000 }
          );
          await page.locator("[data-dashboard-refresh-result]").waitFor();
          assert.equal(
            await module("monthTraffic")
              .locator(".dashboard-metric__value .sr-only")
              .innerText(),
            previousTraffic
          );
          assert.equal(
            await freshness("trafficRanking")
              .locator("time")
              .getAttribute("datetime"),
            trafficTime
          );
          assert.notEqual(
            await freshness("income").locator("time").getAttribute("datetime"),
            revenueTime
          );
          assert.equal(
            await freshness("income").getAttribute("data-freshness"),
            "ready"
          );
          assert.notEqual(
            await page.locator("[data-dashboard-refresh-result]").innerText(),
            d.freshness.allUpdated
          );
          await screenshot("dashboard-partial");

          mode = "all-fail";
          await page.reload();
          await page.waitForFunction(
            () =>
              document.querySelector(
                '[data-dashboard-module="income"] [data-freshness="unavailable"]'
              ),
            { timeout: 30_000 }
          );
          for (const id of [
            "income",
            "newUsers",
            "onlineUsers",
            "monthTraffic",
          ])
            assert.equal(
              (
                await module(id).locator(".dashboard-metric__value").innerText()
              ).trim(),
              "—"
            );
          await screenshot("dashboard-unavailable");
          mode = "normal";
          await page
            .getByRole("button", { name: d.overview.refresh, exact: true })
            .click();
          await page
            .getByText(d.freshness.allUpdated, { exact: true })
            .waitFor();

          // A real back/forward entry, not a reload, exercises the route blocker.
          await module("servers").locator("a").first().click();
          await page
            .getByRole("button", { name: s.moreActions, exact: true })
            .first()
            .click();
          await page
            .locator('[role="menuitem"], [data-admin-action-menu-control]')
            .filter({ hasText: s.server_node_config.trigger })
            .click();
          const dialog = page.getByRole("dialog");
          await dialog
            .getByRole("switch", {
              name: s.server_node_config.inherit_ip_strategy,
              exact: true,
            })
            .click();
          const changed = dialog.getByRole("switch", {
            name: s.server_node_config.inherit_ip_strategy,
            exact: true,
          });
          assert.equal(await changed.getAttribute("aria-checked"), "false");
          await dialog
            .getByRole("button", { name: s.actions.cancel, exact: true })
            .click();
          let confirmation = page.getByRole("alertdialog");
          await confirmation
            .getByRole("button", {
              name: c.formSafety.keepEditing,
              exact: true,
            })
            .click();
          assert.equal(await changed.getAttribute("aria-checked"), "false");
          await page.evaluate(() => window.history.back());
          confirmation = page.getByRole("alertdialog");
          await confirmation
            .getByRole("button", {
              name: c.formSafety.keepEditing,
              exact: true,
            })
            .click();
          assert(page.url().includes("/dashboard/servers"));

          await dialog
            .getByRole("button", { name: s.actions.save, exact: true })
            .click();
          confirmation = page.getByRole("alertdialog");
          await confirmation
            .getByRole("heading", {
              name: c.formSafety.reviewTitle,
              exact: true,
            })
            .waitFor();
          assert.equal(saves, 0);
          assert(
            (
              await confirmation
                .locator("[data-form-change-summary]")
                .innerText()
            ).length > 0
          );
          await screenshot("form-review");
          await confirmation
            .getByRole("button", {
              name: c.formSafety.confirmSave,
              exact: true,
            })
            .click();
          await dialog
            .getByRole("button", { name: s.actions.save, exact: true })
            .waitFor();
          await page
            .getByText(s.server_node_config.saveFailed, { exact: true })
            .waitFor();
          assert.equal(await changed.getAttribute("aria-checked"), "false");
          assert.equal(saves, 1);
          failSave = false;
          await dialog
            .getByRole("button", { name: s.actions.save, exact: true })
            .click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", {
              name: c.formSafety.confirmSave,
              exact: true,
            })
            .click();
          await dialog.waitFor({ state: "hidden" });
          assert.equal(saves, 2);
          const u = locale(language, "user");
          await page.goto(`${origin}/#/dashboard/user`);
          await page
            .getByRole("button", { name: u.edit, exact: true })
            .first()
            .click();
          const profile = page.getByRole("dialog");
          await profile
            .getByLabel(u.referralCode, { exact: true })
            .fill("UNSAVED-PROFILE");
          await profile
            .getByRole("tab", { name: u.notifySettingsTitle, exact: true })
            .click();
          await profile
            .getByRole("tab", { name: u.basicInfoTitle, exact: true })
            .click();
          assert.equal(
            await profile
              .getByLabel(u.referralCode, { exact: true })
              .inputValue(),
            "UNSAVED-PROFILE"
          );
          await profile.locator('[data-slot="dialog-close"]').click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", {
              name: c.formSafety.keepEditing,
              exact: true,
            })
            .click();
          assert.equal(
            await profile
              .getByLabel(u.referralCode, { exact: true })
              .inputValue(),
            "UNSAVED-PROFILE"
          );
          await profile.locator('[data-slot="dialog-close"]').click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: c.formSafety.discard, exact: true })
            .click();
          await profile.waitFor({ state: "hidden" });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth
            ),
            false
          );
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              width,
              language,
              theme,
              staleDataRetained: true,
              noFakeZero: true,
              protectedNavigation: true,
              saveRetry: true,
              status: "passed",
            })
          );
        } catch (error) {
          console.error(error);
          if (artifacts)
            await context.pages()[0]?.screenshot({
              path: path.join(
                artifacts,
                `failure-${width}-${language}-${theme}.png`
              ),
              animations: "disabled",
            });
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
