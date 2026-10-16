import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

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
    throw new Error("Local preview and mock only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts && existsSync(path.join(artifacts, "report.json")))
  throw new Error(
    "Preserve existing evidence; select a new artifact directory"
  );
if (artifacts) mkdirSync(artifacts, { recursive: true });
const fixedTime = process.env.BASELINE_TIME || new Date().toISOString();
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440")
  .split(",")
  .map(Number);
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
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const report = {
  fixedTime,
  browserVersion: browser.version(),
  backend: "local mock only",
  cases: [],
};
try {
  for (const width of widths)
    for (const [language, theme, reducedMotion] of [
      ["en-US", "light", "no-preference"],
      ["zh-CN", "dark", "reduce"],
    ]) {
      const id = `${width}-${language}-${theme}`;
      await test(`Admin motion and hierarchy ${id}`, async () => {
        const context = await browser.newContext({
          viewport: { width, height: width < 500 ? 844 : 900 },
          hasTouch: width < 1280,
          isMobile: width < 500,
          reducedMotion,
        });
        const result = {
          id,
          passed: false,
          errors: [],
          writes: [],
          evidence: [],
        };
        report.cases.push(result);
        let closing = false;
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
              const request = route.request();
              const url = new URL(request.url());
              const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
              if (request.method() !== "GET") {
                result.writes.push(`${request.method()} ${apiPath}`);
                return await route.abort();
              }
              await route.fulfill({
                response: await context.request.get(
                  `${mock}${apiPath}${url.search}`
                ),
              });
            } catch (error) {
              if (!closing) throw error;
            }
          });
          const page = await context.newPage();
          page.on("pageerror", (error) => result.errors.push(error.message));
          await page.clock.setFixedTime(new Date(fixedTime));
          const open = async (route) => {
            await page.goto("about:blank");
            await page.goto(`${origin}/#${route}`);
          };
          const capture = async (surface) => {
            await page.waitForTimeout(1000);
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
            );
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth > innerWidth + 1
              ),
              false,
              `${surface} must not overflow the viewport`
            );
            const screenshot = `${id}-${surface}.png`;
            if (artifacts)
              await page.screenshot({
                path: path.join(artifacts, screenshot),
                animations: "allow",
              });
            result.evidence.push(screenshot);
          };
          const u = locale(language, "user"),
            p = locale(language, "product");
          await open("/dashboard");
          await page
            .locator(
              '[data-dashboard-module="trafficRanking"] [data-freshness="ready"]'
            )
            .waitFor();
          const settings = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
              mode: document.documentElement.dataset.motion,
              menu: style
                .getPropertyValue("--admin-motion-menu-enter-duration")
                .trim(),
              page: getComputedStyle(
                document.querySelector(".admin-page-header__title")
              ).fontSize,
              meta: style.getPropertyValue("--admin-type-meta").trim(),
            };
          });
          assert.equal(
            settings.mode,
            reducedMotion === "reduce" ? "reduced" : "full"
          );
          assert.equal(
            settings.menu,
            reducedMotion === "reduce" ? "0ms" : "160ms"
          );
          assert.equal(settings.page, "24px");
          assert.equal(Number.parseFloat(settings.meta), 0.75);
          assert(settings.meta.endsWith("rem"));
          // A live preference change must reach both React and root CSS tokens.
          const changedMode = reducedMotion === "reduce" ? "full" : "reduced";
          await page.emulateMedia({
            reducedMotion:
              reducedMotion === "reduce" ? "no-preference" : "reduce",
          });
          await page.waitForFunction(
            (mode) => document.documentElement.dataset.motion === mode,
            changedMode
          );
          assert.equal(
            await page.evaluate(() =>
              document.documentElement.style.getPropertyValue(
                "--admin-motion-menu-enter-duration"
              )
            ),
            changedMode === "reduced" ? "0ms" : "160ms"
          );
          await page.emulateMedia({ reducedMotion });
          await page.waitForFunction(
            (mode) => document.documentElement.dataset.motion === mode,
            settings.mode
          );
          const trafficTones = await page
            .locator(".dashboard-traffic-row .admin-status-chip")
            .evaluateAll((nodes) => nodes.map((node) => node.dataset.tone));
          assert(
            trafficTones.every((tone) => !["success", "danger"].includes(tone)),
            "Traffic growth is not a health status"
          );
          await capture("dashboard");

          await open("/dashboard/user");
          await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
          const rows = page.locator(
            width < 1280
              ? ".admin-pro-table-mobile"
              : ".admin-pro-table-desktop"
          );
          const more = rows
            .getByRole("button", { name: u.moreActions, exact: true })
            .first();
          await more.click();
          if (width < 1024) {
            await page
              .locator('[data-admin-action-menu-current-level="root"]')
              .getByRole("button", { name: u.logsAndRecords, exact: true })
              .click();
            await page.waitForFunction(
              () =>
                !document.querySelector(
                  '[data-admin-action-menu-current-level="root"]'
                ) &&
                document.querySelector(
                  '[data-admin-action-menu-current-level="user-logs"]'
                )
            );
          } else {
            const logs = page.getByRole("menuitem", {
              name: u.logsAndRecords,
              exact: true,
            });
            await logs.focus();
            await logs.press("ArrowRight");
          }
          const submenu = page.locator(
            width < 1024
              ? '[data-admin-action-menu-current-level="user-logs"]'
              : '[data-slot="dropdown-menu-sub-content"][data-state="open"]'
          );
          await submenu.getByText(u.loginLogs, { exact: true }).waitFor();
          await capture("submenu");
          const painted = await submenu.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return document
              .elementsFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2
              )
              .some((node) => element.contains(node));
          });
          assert(
            painted,
            "An open submenu must be actually painted, not clipped by its parent"
          );
          if (width >= 1024) {
            const timing = await submenu.evaluate((node) => ({
              actual:
                Number.parseFloat(getComputedStyle(node).animationDuration) *
                1000,
              configured: Number.parseFloat(
                document.documentElement.style.getPropertyValue(
                  "--admin-motion-submenu-duration"
                )
              ),
            }));
            assert(
              Math.abs(timing.actual - timing.configured) < 0.02,
              "Submenu CSS must consume the semantic preset"
            );
          }
          await page.keyboard.press("Escape");
          await page.keyboard.press("Escape");
          await rows.getByTitle(u.edit, { exact: true }).first().click();
          let dialog = page.getByRole("dialog");
          await dialog.locator(".admin-user-profile-section:visible").waitFor();
          const section = await dialog
            .locator(".admin-user-profile-section:visible")
            .evaluate((node) => ({
              border: getComputedStyle(node).borderTopWidth,
              background: getComputedStyle(node).backgroundColor,
            }));
          assert.equal(section.border, "0px");
          assert.equal(section.background, "rgba(0, 0, 0, 0)");
          assert.equal(
            await dialog
              .locator('[data-slot="button"][data-variant="default"]:visible')
              .count(),
            1,
            "One primary save in the active profile region"
          );
          await capture("user-profile");
          await dialog.locator('[data-slot="dialog-close"]').click();
          await dialog.waitFor({ state: "hidden" });

          await open("/dashboard/servers/42");
          dialog = page.getByRole("dialog");
          await dialog.locator('[data-form-field="name"]').waitFor();
          const vless = dialog
            .locator('[data-slot="accordion-trigger"]')
            .filter({ hasText: /^vless/i });
          if ((await vless.getAttribute("data-state")) !== "open")
            await vless.click();
          const legend = dialog
            .locator("fieldset.admin-form-section:visible legend")
            .first();
          await legend.waitFor();
          await legend.scrollIntoViewIfNeeded();
          const hierarchy = await dialog.evaluate((node) => {
            const group = node.querySelector("fieldset.admin-form-section");
            const label = node.querySelector('[data-slot="form-label"]');
            return {
              title: getComputedStyle(
                node.querySelector('[data-slot="dialog-title"]')
              ).fontSize,
              label: getComputedStyle(label).fontSize,
              border: getComputedStyle(group).borderLeftWidth,
              legend: group.querySelector("legend")?.textContent,
              marker:
                node.querySelector('[data-form-path^="protocols."]') !== null,
            };
          });
          assert.equal(hierarchy.title, "18px");
          assert.equal(hierarchy.label, "14px");
          assert.equal(hierarchy.border, "0px");
          assert(
            hierarchy.legend && hierarchy.marker,
            "Preserve fieldset/legend and error-location markers"
          );
          await capture("server-protocol");
          await dialog.locator('[data-slot="dialog-close"]').click();
          await dialog.waitFor({ state: "hidden" });

          await open("/dashboard/product/11");
          dialog = page.getByRole("dialog");
          await dialog
            .getByRole("tab", { name: p.form.pricing, exact: true })
            .click();
          await capture("product-pricing");
          await dialog.locator('[data-slot="dialog-close"]').click();
          await dialog.waitFor({ state: "hidden" });
          assert.deepEqual(result.errors, []);
          assert.deepEqual(result.writes, []);
          result.passed = true;
        } catch (error) {
          result.failure = String(error);
          if (artifacts)
            await context
              .pages()[0]
              ?.screenshot({
                path: path.join(artifacts, `${id}-failure.png`),
                animations: "allow",
              })
              .catch((captureError) => {
                result.screenshotFailure = String(captureError);
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
  if (artifacts)
    writeFileSync(
      path.join(artifacts, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
}
