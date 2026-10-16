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
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Local fixtures only"
  );
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(
    !existsSync(path.join(artifacts, "report.json")),
    "Preserve earlier evidence"
  );
  mkdirSync(artifacts, { recursive: true });
}
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
  backend: "local mock only; no business writes",
  browserVersion: browser.version(),
  cases: [],
};
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
        hasTouch: width < 1280,
        isMobile: width < 500,
        reducedMotion,
      });
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
            if (closing) return route.abort();
            const request = route.request();
            const url = new URL(request.url());
            const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
            if (request.method() !== "GET") {
              result.writes.push(`${request.method()} ${apiPath}`);
              return route.abort();
            }
            await route.fulfill({
              response: await context.request.get(
                `${mock}${apiPath}${url.search}`
              ),
            });
          } catch (error) {
            if (!closing) result.errors.push(`Mock route: ${error}`);
            await route.abort().catch(() => {});
          }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(12_000);
        page.on("pageerror", (error) => result.errors.push(error.message));
        await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
        const open = async (route) => {
          await page.goto("about:blank");
          await page.goto(`${origin}/#${route}`);
        };
        const capture = async (name, settle = true) => {
          if (settle) await page.waitForTimeout(350);
        if (settle) {
          // Suspense may restart a layout effect after the row becomes available.
          // Wait for the real transient effect, not just an arbitrary screenshot delay.
          await page.waitForFunction(() => {
            const node = document.querySelector(".admin-page-transition");
            return node && Number(getComputedStyle(node).opacity) > 0.99 &&
              !node.getAnimations().some((animation) => animation.playState === "running");
          });
          const visibility = await page.locator(".admin-page-transition").evaluate((node) => ({ opacity: getComputedStyle(node).opacity, display: getComputedStyle(node).display }));
          assert(Number(visibility.opacity) > 0.99 && visibility.display !== "none", `${name}: page content must actually be painted (${JSON.stringify(visibility)})`);
        }
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1
            ),
            false,
            `${name}: no viewport overflow`
          );
          const filename = `${id}-${name}.png`;
          if (artifacts)
            await page.screenshot({
              path: path.join(artifacts, filename),
              animations: "allow",
            });
          result.evidence.push(filename);
        };
        const checkIndicator = async (list) => {
          await page.waitForTimeout(260);
          const geometry = await list.evaluate((node) => {
            const active = node.querySelector(
              ':scope > [data-slot="tabs-trigger"][data-state="active"]'
            );
            const pseudo = getComputedStyle(node, "::before");
            const matrix = new DOMMatrix(
              pseudo.transform === "none" ? undefined : pseudo.transform
            );
            return {
              x: matrix.e,
              y: matrix.f,
              width: Number.parseFloat(pseudo.width),
              height: Number.parseFloat(pseudo.height),
              expectedX: active.offsetLeft,
              expectedY: active.offsetTop,
              expectedWidth: active.offsetWidth,
              expectedHeight: active.offsetHeight,
              ready: node.dataset.indicatorReady,
            };
          });
          assert.equal(geometry.ready, "true");
          for (const key of ["X", "Y", "Width", "Height"])
            assert(
              Math.abs(
                geometry[key.toLowerCase()] - geometry[`expected${key}`]
              ) < 1.1,
              `${key}: measured selection matches active tab`
            );
        };

        const p = locale(language, "product");
        const u = locale(language, "user");
        const c = locale(language, "components");
        await open("/dashboard/product/11");
        let dialog = page.getByRole("dialog");
        const basic = dialog.getByRole("tab", {
          name: p.form.basic,
          exact: true,
        });
        const tabs = dialog.locator('[data-slot="tabs-list"]').first();
        await tabs.waitFor();
        await checkIndicator(tabs);
        const name = dialog.locator('[data-form-field="name"]');
        await name.waitFor();
        await name.evaluate((node) => {
          window.__draftInput = node;
        });
        const originalName = await name.inputValue();
        await name.fill(`${originalName} edited locally`);
        await dialog
          .getByRole("tab", { name: p.form.pricing, exact: true })
          .click();
        await checkIndicator(tabs);
        assert(
          await page.evaluate(
            () =>
              window.__draftInput.isConnected &&
              window.__draftInput.closest('[role="tabpanel"]').hidden
          ),
          "Visited form panel retained but hidden"
        );
        await capture("pricing");
        await basic.click();
        assert(
          await name.evaluate((node) => window.__draftInput === node),
          "Returning to a form tab must not recreate the input"
        );
        assert.equal(await name.inputValue(), `${originalName} edited locally`);
        await name.fill(originalName);
        await dialog.locator('[data-slot="dialog-close"]').click();
        await dialog.waitFor({ state: "hidden" });

        await open("/dashboard/servers");
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        await page.evaluate(() => {
          window.__pageWrapper = document.querySelector(
            ".admin-page-transition"
          );
          window.__table = document.querySelector(".admin-pro-table");
        });
        const surface = page.locator(
          width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop"
        );
        await surface
          .getByRole("link", {
            name: locale(language, "servers").edit,
            exact: true,
          })
          .first()
          .click();
        dialog = page.getByRole("dialog");
        await dialog.locator('[data-form-field="name"]').waitFor();
        assert(
          await page.evaluate(
            () =>
              window.__pageWrapper ===
                document.querySelector(".admin-page-transition") &&
              window.__table === document.querySelector(".admin-pro-table")
          ),
          "Workspace route must retain the page and list"
        );
        assert(
          await dialog.evaluate((node) =>
            node.contains(document.activeElement)
          ),
          "Route focus must not steal Dialog focus"
        );
        const field = dialog.locator('[data-form-field="name"]');
        const serverName = await field.inputValue();
        await field.fill(`${serverName} unsaved`);
        const close = dialog.locator('[data-slot="dialog-close"]');
        await close.click();
        const confirmation = page.getByRole("alertdialog");
        await confirmation
          .getByRole("button", { name: c.formSafety.keepEditing, exact: true })
          .click();
        await confirmation.waitFor({ state: "hidden" });
        assert(
          await close.evaluate((node) => node === document.activeElement),
          "Keep editing returns focus without scrolling"
        );
        assert.equal(await field.inputValue(), `${serverName} unsaved`);
        await capture("server-keep-editing");
        await field.fill(serverName);
        await close.click();
        await dialog.waitFor({ state: "hidden" });
        assert(
          await page.evaluate(
            () =>
              window.__pageWrapper ===
                document.querySelector(".admin-page-transition") &&
              window.__table === document.querySelector(".admin-pro-table")
          ),
          "Closing workspace retains table identity"
        );

        if (width >= 1024) {
          const indicator = page.locator(".admin-sidebar-active-indicator");
          assert(
            await indicator.evaluate(
              (node) => Number.parseFloat(getComputedStyle(node).width) > 0
            )
          );
          const link = page
            .locator(
              '.admin-sidebar [data-slot="sidebar-menu-sub-button"][href*="/dashboard/user"]'
            )
            .first();
          await link.click();
          await page.waitForURL((url) =>
            url.hash.startsWith("#/dashboard/user")
          );
          await page
            .locator(
              width < 1280
                ? ".admin-pro-table-mobile"
                : ".admin-pro-table-desktop"
            )
            .getByRole("button", { name: u.moreActions, exact: true })
            .first()
            .waitFor();
          await capture("sidebar-navigation");
          const toggle = page.locator('[data-slot="sidebar-trigger"]').first();
          for (const state of ["collapsed", "expanded"]) {
            await toggle.click();
            await page.waitForTimeout(500);
            const aligned = await indicator.evaluate((node) => {
              const scroll = node.parentElement;
              const active = scroll.querySelector(
                '[data-sidebar="menu-button"][data-active="true"], [data-sidebar="menu-sub-button"][data-active="true"]'
              );
              const a = active.getBoundingClientRect(),
                b = node.getBoundingClientRect();
              return (
                Math.abs(a.x - b.x) < 1.2 &&
                Math.abs(a.y - b.y) < 1.2 &&
                Math.abs(a.width - b.width) < 1.2
              );
            });
            assert(
              aligned,
              `${state}: Sidebar selection tracks actual geometry`
            );
          }
          await capture("sidebar-restored");
        } else await open("/dashboard/user");
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const users = page.locator(
          width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop"
        );
        const more = users
          .getByRole("button", { name: u.moreActions, exact: true })
          .first();
        await more.click();
        if (width < 1024) {
          const root = page.locator(
            '[data-admin-action-menu-current-level="root"]'
          );
          await root
            .getByRole("button", { name: u.logsAndRecords, exact: true })
            .click();
          await page.waitForTimeout(35);
          assert(
            await page
              .locator('[data-admin-action-menu-current-level="root"]')
              .evaluateAll((nodes) => nodes.every((node) => node.inert)),
            "Exiting level cannot receive input"
          );
          await capture("menu-transition", false);
          await page
            .locator('[data-admin-action-menu-current-level="user-logs"]')
            .waitFor();
          await page.keyboard.press("Escape");
          await page.waitForFunction(() =>
            document.activeElement?.hasAttribute(
              "data-admin-action-menu-sub-trigger"
            )
          );
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        } else {
          const logs = page.getByRole("menuitem", {
            name: u.logsAndRecords,
            exact: true,
          });
          await logs.focus();
          await logs.press("ArrowRight");
          await page
            .getByRole("menuitem", { name: u.loginLogs, exact: true })
            .waitFor();
          await capture("desktop-submenu");
          await page.keyboard.press("Escape");
          await page.keyboard.press("Escape");
        }
        await page.waitForFunction(
          (label) =>
            document.activeElement?.getAttribute("aria-label") === label ||
            document.activeElement?.getAttribute("title") === label,
          u.moreActions
        );
        await capture("menu-focus-restored");
        assert.deepEqual(result.errors, []);
        assert.deepEqual(result.writes, []);
        result.passed = true;
        console.log(`${id}: passed`);
      } catch (error) {
        result.failure = String(error);
        if (artifacts)
          await context.pages()[0]?.screenshot({
            path: path.join(artifacts, `${id}-failure.png`),
            animations: "allow",
          });
        console.error(`${id}: ${error}`);
      } finally {
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
assert(
  report.cases.every((item) => item.passed),
  "All browser cases must pass"
);
