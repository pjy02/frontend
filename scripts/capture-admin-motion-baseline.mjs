import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Phase 1 only: capture existing UI with local fixtures. No business mutations.
const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const expectedSha =
  process.env.BASELINE_SHA || "025a10680fd370d2236ca29db554562430f8e5d5";
requireCondition(
  git("rev-parse", "HEAD") === expectedSha,
  "Use a new baseline SHA/output directory for a different revision"
);
requireCondition(git("branch", "--show-current") === "main", "Stay on main");
const runtimeChanges = git(
  "status",
  "--porcelain",
  "--",
  "apps/admin/src",
  "apps/admin/public",
  "apps/admin/vite.config.ts",
  "apps/user/src",
  "packages/ui/src",
  "package.json",
  "bun.lock"
);
requireCondition(
  runtimeChanges === "",
  "Do not capture changed runtime code as the original baseline"
);
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const value of [origin, mock]) {
  const url = new URL(value);
  requireCondition(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    "Baseline capture may only use local HTTP preview and fixtures"
  );
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
requireCondition(
  artifacts,
  "Set ACCEPTANCE_ARTIFACT_DIR to a new local evidence directory"
);
const manifestPath = path.join(artifacts, "manifest.json");
requireCondition(
  !existsSync(manifestPath),
  "Preserve the original evidence; choose a new output directory"
);
mkdirSync(artifacts, { recursive: true });
const fixedTime = process.env.BASELINE_TIME || new Date().toISOString();
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const manifest = {
  schema: 1,
  sha: expectedSha,
  branch: "main",
  fixedTime,
  browserVersion: browser.version(),
  runtimeSourceClean: true,
  scope:
    "Settled screenshot/computed-style baseline, not a full motion or live-backend acceptance",
  evidence: [],
  cases: [],
};
const locales = (language, namespace) =>
  JSON.parse(
    readFileSync(
      path.join(
        root,
        "apps/admin/public/assets/locales",
        language,
        `${namespace}.json`
      ),
      "utf8"
    )
  );
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    for (const [language, theme, reducedMotion] of [
      ["en-US", "light", "no-preference"],
      ["zh-CN", "dark", "reduce"],
    ]) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 1280,
        isMobile: viewport.width < 500,
        reducedMotion,
      });
      const errors = [],
        writes = [];
      const caseId = `${viewport.width}x${viewport.height}-${language}-${theme}`;
      const result = {
        id: caseId,
        viewport,
        language,
        theme,
        reducedMotion,
        passed: false,
        errors,
        writes,
      };
      manifest.cases.push(result);
      let closing = false;
      try {
        await context.addCookies([
          { name: "Authorization", value: "acceptance-token", url: origin },
          { name: "theme", value: theme, url: origin },
        ]);
        await context.addInitScript((locale) => {
          if (location.protocol === "http:")
            localStorage.setItem("language", locale);
        }, language);
        await context.route("**/v1/**", async (route) => {
          try {
            if (closing) return await route.abort();
            const request = route.request();
            const url = new URL(request.url());
            const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
            if (request.method() !== "GET") {
              writes.push(`${request.method()} ${apiPath}`);
              return await route.abort();
            }
            const response = await context.request.get(
              `${mock}${apiPath}${url.search}`
            );
            await route.fulfill({ response });
          } catch (error) {
            if (!closing) throw error;
          }
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.clock.setFixedTime(new Date(fixedTime));
        const open = async (route) => {
          await page.goto("about:blank");
          await page.goto(`${origin}/#${route}`);
        };
        const capture = async (surface, verify) => {
          // Intentional settled-state capture: the current longest chart draw is
          // 650ms. This is not evidence about intermediate animation frames.
          await page.waitForTimeout(1000);
          await verify?.();
          // Demand rendered frames as well as elapsed wall time. A mounted
          // submenu can still be transparent while its outgoing sibling exists.
          await page.evaluate(
            () =>
              new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
              })
          );
          const selectors = [
            ".admin-page-transition",
            ".admin-page-header__title",
            ".admin-page-header__description",
            ".admin-sidebar-active-indicator",
            ".admin-pro-table-card",
            ".admin-pro-table-row",
            ".dashboard-fade-through-stage",
            ".dashboard-fade-through-panel",
            ".dashboard-traffic-bar",
            '[data-slot="dialog-overlay"]',
            '[data-slot="dialog-content"]',
            '[data-slot="tabs-list"]',
            '[data-slot="tabs-content"][data-state="active"]',
            '[data-slot="accordion-content"]',
            ".admin-action-menu-content",
            ".admin-action-menu-mobile-level",
            '[data-slot="button"]',
            '[data-slot="form-label"]',
          ];
          const styles = await page.evaluate(
            (selectors) =>
              selectors.flatMap((selector) =>
                [...document.querySelectorAll(selector)]
                  .filter((element) => element.getClientRects().length)
                  .slice(0, 4)
                  .map((element) => {
                    const s = getComputedStyle(element);
                    return {
                      selector,
                      slot: element.getAttribute("data-slot"),
                      state: element.getAttribute("data-state"),
                      animationName: s.animationName,
                      animationDuration: s.animationDuration,
                      animationTimingFunction: s.animationTimingFunction,
                      transitionProperty: s.transitionProperty,
                      transitionDuration: s.transitionDuration,
                      transitionTimingFunction: s.transitionTimingFunction,
                      transform: s.transform,
                      translate: s.translate,
                      scale: s.scale,
                      willChange: s.willChange,
                      fontSize: s.fontSize,
                      fontWeight: s.fontWeight,
                      lineHeight: s.lineHeight,
                    };
                  })
              ),
            selectors
          );
          const screenshot = `${caseId}-${surface}.png`;
          await page.screenshot({
            path: path.join(artifacts, screenshot),
            animations: "allow",
          });
          manifest.evidence.push({
            caseId,
            surface,
            url: new URL(page.url()).hash,
            screenshot,
            motionMode: await page.locator("html").getAttribute("data-motion"),
            menuState: await page.evaluate(() =>
              [
                ...document.querySelectorAll(
                  "[data-admin-action-menu-current-level], .admin-action-menu-content"
                ),
              ]
                .filter((element) => element.getClientRects().length)
                .map((element) => ({
                  level:
                    element.getAttribute(
                      "data-admin-action-menu-current-level"
                    ) ?? element.getAttribute("data-admin-action-menu-level"),
                  text: element.textContent,
                  opacity: getComputedStyle(element).opacity,
                  transform: getComputedStyle(element).transform,
                }))
            ),
            styles,
          });
        };
        const u = locales(language, "user");
        const p = locales(language, "product");
        const s = locales(language, "servers");
        await open("/dashboard");
        await page
          .locator(
            '[data-dashboard-module="trafficRanking"] [data-freshness="ready"]'
          )
          .waitFor();
        await capture("dashboard");
        await open("/dashboard/user");
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const rowSurface = page.locator(
          viewport.width < 1280
            ? ".admin-pro-table-mobile"
            : ".admin-pro-table-desktop"
        );
        await rowSurface
          .getByText("mobile.acceptance@example.com", { exact: true })
          .first()
          .waitFor();
        await capture("users");
        await rowSurface
          .getByRole("button", { name: u.moreActions, exact: true })
          .first()
          .click();
        await capture("user-menu-root");
        if (viewport.width < 1024) {
          await page
            .locator('[data-admin-action-menu-current-level="root"]')
            .getByRole("button", { name: u.logsAndRecords, exact: true })
            .click();
          await page
            .locator('[data-admin-action-menu-current-level="user-logs"]')
            .waitFor();
        } else {
          const trigger = page.getByRole("menuitem", {
            name: u.logsAndRecords,
            exact: true,
          });
          await trigger.focus();
          await trigger.press("ArrowRight");
          await page
            .locator(
              '[data-slot="dropdown-menu-sub-content"][data-state="open"]'
            )
            .waitFor();
        }
        await capture("user-menu-logs", async () => {
          await page.waitForFunction(
            (mobile) => {
              const outgoing = document.querySelector(
                '[data-admin-action-menu-current-level="root"]'
              );
              const incoming = document.querySelector(
                mobile
                  ? '[data-admin-action-menu-current-level="user-logs"]'
                  : '[data-slot="dropdown-menu-sub-content"][data-state="open"]'
              );
              return (
                !(mobile && outgoing) &&
                incoming &&
                Number(getComputedStyle(incoming).opacity) >= 0.99
              );
            },
            viewport.width < 1024,
            { timeout: 5000 }
          );
          const logs =
            viewport.width < 1024
              ? page.locator(
                  '[data-admin-action-menu-current-level="user-logs"]'
                )
              : page.locator(
                  '[data-slot="dropdown-menu-sub-content"][data-state="open"]'
                );
          requireCondition(
            await logs.isVisible(),
            "Log submenu did not remain open for settled capture"
          );
          requireCondition(
            await logs.getByText(u.loginLogs, { exact: true }).isVisible(),
            "Log submenu must display its actual actions"
          );
        });
        // Close the menu without invoking a log, destructive action or submit.
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await open("/dashboard/servers");
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const serverRows = page.locator(
          viewport.width < 1280
            ? ".admin-pro-table-mobile"
            : ".admin-pro-table-desktop"
        );
        await serverRows
          .getByRole("button", { name: s.moreActions, exact: true })
          .first()
          .click();
        await page
          .locator('[role="menuitem"], [data-admin-action-menu-control]')
          .filter({ hasText: s.server_node_config.trigger })
          .click();
        let dialog = page.getByRole("dialog");
        await dialog
          .getByRole("switch", {
            name: s.server_node_config.inherit_ip_strategy,
            exact: true,
          })
          .waitFor();
        await capture("server-node-config");
        await dialog.locator('[data-slot="dialog-close"]').click();
        await dialog.waitFor({ state: "hidden" });
        await open("/dashboard/servers/42");
        dialog = page.getByRole("dialog");
        await dialog.locator('[data-form-field="name"]').waitFor();
        await capture("server-form");
        const vless = dialog
          .locator('[data-slot="accordion-trigger"]')
          .filter({ hasText: /^vless/i });
        if ((await vless.getAttribute("data-state")) !== "open")
          await vless.click();
        await capture("server-protocol-expanded");
        await dialog.locator('[data-slot="dialog-close"]').click();
        await dialog.waitFor({ state: "hidden" });
        await open("/dashboard/product/11");
        dialog = page.getByRole("dialog");
        await dialog
          .getByRole("tab", { name: p.form.basic, exact: true })
          .waitFor();
        await capture("product-basic");
        await dialog
          .getByRole("tab", { name: p.form.pricing, exact: true })
          .click();
        await capture("product-pricing");
        await dialog.locator('[data-slot="dialog-close"]').click();
        await dialog.waitFor({ state: "hidden" });
        requireCondition(
          writes.length === 0,
          "A baseline capture must never submit business writes"
        );
        requireCondition(
          errors.length === 0,
          `Browser errors: ${errors.join("; ")}`
        );
        result.passed = true;
        console.log(`PASS ${caseId}`);
      } catch (error) {
        result.failure = String(error);
        throw error;
      } finally {
        closing = true;
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(
  `Saved ${manifest.evidence.length} screenshots and computed-style records to ${manifestPath}`
);
