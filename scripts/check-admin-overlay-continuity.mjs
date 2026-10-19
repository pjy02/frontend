import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const value of [origin, mock]) {
  const url = new URL(value);
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local fixtures only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) { assert(!existsSync(path.join(artifacts, "report.json")), "Preserve evidence"); mkdirSync(artifacts, { recursive: true }); }
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { scope: "Local GET mock only. No business writes, backend integration or physical touch-device performance claims.", browser: browser.version(), cases: [] };
try {
  for (const width of (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440").split(",").map(Number))
    for (const [language, theme, reduced] of [["en-US", "light", false], ["zh-CN", "dark", true]]) {
      const result = { width, language, theme, reduced, passed: false, errors: [], evidence: [], timings: {} };
      report.cases.push(result);
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1024, isMobile: width < 500, reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: theme });
      let closing = false;
      try {
        await context.addCookies([{ name: "Authorization", value: "acceptance-token", url: origin }, { name: "theme", value: theme, url: origin }]);
        await context.addInitScript((language) => {
          localStorage.setItem("language", language);
          window.__reveals = []; window.__captures = []; window.__focusTrace = [];
          document.addEventListener("focusin", (event) => window.__focusTrace.push({ label: event.target.getAttribute?.("aria-label") || event.target.textContent?.slice(0, 40), slot: event.target.dataset?.slot }), true);
          const start = document.startViewTransition?.bind(document);
          if (start) document.startViewTransition = (callback) => {
            window.__captures.push({ menus: document.querySelectorAll('[role="menu"]').length, focus: document.activeElement?.dataset?.slot });
            return start(callback);
          };
          const animate = Element.prototype.animate;
          Element.prototype.animate = function (frames, options) {
            const current = animate.call(this, frames, options);
            if (options?.pseudoElement === "::view-transition-new(root)") {
              current.pause(); current.currentTime = options.duration / 2;
              window.__reveals.push({ animation: current, options, frames });
            }
            return current;
          };
        }, language);
        await context.route("**/v1/**", async (route) => {
          if (closing) return route.abort();
          const request = route.request();
          if (request.method() !== "GET") { result.errors.push(`Forbidden write: ${request.method()} ${request.url()}`); return route.abort(); }
          const url = new URL(request.url());
          try { await route.fulfill({ response: await context.request.get(`${mock}${url.pathname}${url.search}`) }); }
          catch (error) { if (!closing) result.errors.push(String(error)); await route.abort().catch(() => {}); }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on("pageerror", (error) => result.errors.push(error.message));
        const components = locale(language, "components"), user = locale(language, "user");
        const capture = async (name, allow = false) => {
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
          if (artifacts) {
            const file = `${width}-${language}-${name}.png`;
            await page.screenshot({ path: path.join(artifacts, file), animations: allow ? "allow" : "disabled" });
            result.evidence.push(file);
          }
        };
        const visit = async (route) => { await page.goto(`${origin}/#${route}`); await page.locator('.admin-pro-table[aria-busy="false"]').waitFor(); };
        await visit("/dashboard/user");
        await page.evaluate(() => { window.__table = document.querySelector(".admin-pro-table"); window.__shell = document.querySelector(".admin-shell"); });
        const themeTrigger = page.getByRole("button", { name: components.theme.toggle, exact: true });
        const changeTheme = async (next) => {
          await themeTrigger.click();
          await page.getByRole("menuitem", { name: components.theme[next], exact: true }).click();
          await page.waitForFunction((theme) => document.documentElement.classList.contains(theme), next);
        };
        const next = theme === "light" ? "dark" : "light";
        await changeTheme(next);
        if (!reduced && width >= 1024) {
          await page.waitForFunction(() => window.__reveals.length === 1);
          assert.equal(await page.evaluate(() => window.__captures[0].menus), 0, "No menu in snapshot");
          await capture("theme-middle", true);
          // Real pointer movement must end the native visual before a real click.
          const rect = await themeTrigger.boundingBox();
          await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
          await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-reveal"));
          await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
          await page.getByRole("menuitem", { name: components.theme[theme], exact: true }).click();
          await page.waitForFunction(() => window.__reveals.length === 2);
          const input = page.locator(`input[placeholder=${JSON.stringify(user.searchUsers)}]:visible`).first();
          await input.waitFor({ state: "visible" });
          const inputRect = await input.boundingBox();
          await page.mouse.move(inputRect.x + inputRect.width / 2, inputRect.y + inputRect.height / 2);
          await page.mouse.click(inputRect.x + inputRect.width / 2, inputRect.y + inputRect.height / 2);
          await input.pressSequentially("motion", { delay: 20 });
          assert.equal(await input.inputValue(), "motion", "A real click and typing are not swallowed by the reveal");
          await input.fill("");
          await page.waitForLoadState("networkidle");
          result.typedDuringReveal = true;
          await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-reveal"));
          await changeTheme(next);
          await page.waitForFunction(() => window.__reveals.length === 3);
          await page.mouse.wheel(0, 180);
          await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-reveal"));
          result.wheelDuringReveal = true;
          // Restore the matrix's requested theme before measuring menu/dialog UI.
          await changeTheme(theme);
          if (await page.evaluate(() => document.documentElement.hasAttribute("data-theme-reveal"))) {
            await page.waitForFunction(() => window.__reveals.length === 4);
            await page.keyboard.press("Tab");
            result.keyboardDuringReveal = true;
          }
          result.interruption = "Real mouse move/click and keyboard input; no synthesized event forwarding";
        } else {
          assert.equal(await page.evaluate(() => window.__reveals.length), 0, "Touch/reduced mode is direct and interactive");
          if (width < 1024) {
            const rect = await themeTrigger.boundingBox();
            await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
            await page.getByRole("menuitem", { name: components.theme[theme], exact: true }).click();
          } else await changeTheme(theme);
          result.interruption = "Stable direct update on reduced/touch-capable contexts";
        }
        await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-reveal") && !document.documentElement.hasAttribute("data-theme-capture"));
        assert(await page.evaluate(() => window.__table === document.querySelector(".admin-pro-table") && window.__shell === document.querySelector(".admin-shell")), "No remount");
        const rows = page.locator(width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop");
        const more = rows.getByRole("button", { name: user.moreActions, exact: true }).first();
        await more.click();
        const panel = page.locator(width < 1024 ? '[data-slot="admin-mobile-action-panel"]' : '[data-admin-action-menu-level="root"]');
        await panel.waitFor();
        const menuPaint = await panel.evaluate((node) => {
          const first = node.querySelector('.admin-action-menu-item:not([data-variant="destructive"])');
          return first ? { background: getComputedStyle(first).backgroundColor, action: getComputedStyle(document.documentElement).getPropertyValue('--admin-action').trim(), marker: first.hasAttribute('data-ui-button') } : null;
        });
        const primary = menuPaint?.action.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)?.slice(1).map((value) => Number.parseInt(value, 16)).join(",");
        assert(menuPaint && !menuPaint.marker && menuPaint.background.replaceAll(" ", "") !== `rgb(${primary})`, "Ordinary menu entries are not solid primary Buttons (a subtle focus state is allowed)");
        if (width < 1024) {
          result.timings.drawer = await panel.evaluate((node) => ({ actual: getComputedStyle(node).animationDuration, expected: document.documentElement.style.getPropertyValue("--admin-motion-expand-duration") }));
          const seconds = Number.parseFloat(result.timings.drawer.actual);
          assert(reduced ? seconds < 0.001 : Math.abs(seconds - 0.3) < 0.002, "Vaul shell consumes tokens, not 500ms");
          await panel.getByRole("button", { name: user.logsAndRecords, exact: true }).click();
          await page.locator('[data-admin-action-menu-current-level="user-logs"]').getByText(user.loginLogs, { exact: true }).waitFor();
          await capture("mobile-submenu");
          await page.keyboard.press("Escape");
          await page.waitForFunction((label) => document.activeElement?.textContent.includes(label), user.logsAndRecords);
        } else {
          const logs = page.getByRole("menuitem", { name: user.logsAndRecords, exact: true });
          await logs.focus(); await page.keyboard.press("ArrowRight");
          const submenu = page.locator('[data-slot="dropdown-menu-sub-content"][data-state="open"]');
          await submenu.waitFor();
          const rect = await submenu.boundingBox();
          assert(rect.x >= 0 && rect.x + rect.width <= width + 1, "Submenu stays inside viewport");
          if (!reduced) {
            const opacity = await submenu.evaluate((node) => {
              const animation = node.getAnimations()[0];
              if (!animation) return null;
              animation.pause(); animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
              return getComputedStyle(node).opacity;
            });
            if (opacity !== null) {
              assert(Number(opacity) > 0 && Number(opacity) < 1, "Submenu has a visible intermediate frame");
              result.timings.submenuMidOpacity = opacity;
              await capture("submenu-middle", true);
              await submenu.evaluate((node) => node.getAnimations().forEach((animation) => animation.finish()));
            }
          }
          await capture("desktop-submenu");
          const parentRect = await logs.boundingBox();
          await page.mouse.move(parentRect.x + parentRect.width / 2, parentRect.y + parentRect.height / 2);
          const itemRect = await submenu.getByText(user.loginLogs, { exact: true }).boundingBox();
          await page.mouse.move(itemRect.x + itemRect.width / 2, itemRect.y + itemRect.height / 2, { steps: 8 });
          assert(await submenu.isVisible(), "Pointer can cross the submenu gap");
          await page.keyboard.press("Escape");
        }
        await page.evaluate(() => { window.__focusTrace = []; });
        await page.getByRole(width < 1024 ? "button" : "menuitem", { name: user.deleteUser, exact: true }).click();
        const dialog = page.getByRole("alertdialog");
        await dialog.waitFor();
        assert(!await page.evaluate((label) => window.__focusTrace.some((event) => event.label === label), user.moreActions), "No trigger focus bounce before confirmation");
        await capture("confirmation");
        await dialog.getByRole("button", { name: user.cancel, exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        await page.waitForFunction((node) => document.activeElement === node, await more.elementHandle());
        await page.goto(`${origin}/#/dashboard/servers/42`);
        const workspace = page.getByRole("dialog");
        await workspace.locator('[data-form-field="name"]').waitFor();
        assert.equal(await page.locator("button button").count(), 0, "Protocol switches are not nested in buttons");
        const vless = workspace.locator('[data-slot="accordion-trigger"]').filter({ hasText: /^vless/i });
        if (await vless.getAttribute("data-state") !== "open") await vless.click();
        await capture("protocol-workspace");
        if (width < 640) {
          const scale = await workspace.evaluate((node) => getComputedStyle(node).getPropertyValue("--admin-dialog-enter-scale"));
          assert.equal(scale.trim(), "1", "Full-screen workspace does not scale");
        }
        if (!reduced) {
          await workspace.evaluate((node) => {
            window.__exitingWorkspace = node;
            const observer = new MutationObserver(() => {
              if (node.dataset.state !== "closed") return;
              const animation = node.getAnimations()[0];
              if (!animation) return;
              animation.pause(); animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
              window.__exitAnimation = animation;
              observer.disconnect();
            });
            observer.observe(node, { attributes: true, attributeFilter: ["data-state"] });
          });
          await workspace.locator('[data-slot="dialog-close"]').click();
          await page.waitForFunction(() => Boolean(window.__exitAnimation));
          assert(await page.evaluate(() => window.__exitingWorkspace.isConnected && window.__exitingWorkspace.inert && Boolean(window.__exitingWorkspace.querySelector('[data-form-field="name"]'))), "Closing form remains painted but cannot accept another action");
          assert.equal(await page.evaluate(() => location.hash.split("?")[0]), "#/dashboard/servers/42", "Route stays until exit completes");
          await capture("workspace-exit-middle", true);
          await page.evaluate(() => window.__exitAnimation.finish());
        } else await workspace.locator('[data-slot="dialog-close"]').click();
        await page.waitForFunction(() => location.hash.split("?")[0] === "#/dashboard/servers");
        if (width === 430 && !reduced) {
          await page.setViewportSize({ width, height: 220 });
          await visit("/dashboard/user");
          await page.locator(".admin-pro-table-mobile").getByRole("button", { name: user.moreActions, exact: true }).first().click();
          const scroll = page.locator(".admin-action-menu-mobile-scroll");
          const logs = page.getByRole("button", { name: user.logsAndRecords, exact: true });
          assert(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight), "Short viewport produces a real scrollable menu");
          await scroll.evaluate((node) => { node.scrollTop = 25; });
          await logs.evaluate((node) => node.addEventListener("pointerdown", () => { window.__levelScrollBefore = node.closest(".admin-action-menu-mobile-scroll").scrollTop; }, { once: true }));
          await logs.click();
          await page.locator('[data-admin-action-menu-current-level="user-logs"]').getByText(user.loginLogs, { exact: true }).waitFor();
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector(".admin-action-menu-mobile-scroll")?.scrollTop === window.__levelScrollBefore);
          await capture("short-viewport-scroll-return");
          result.realScrollableLevelRestored = true;
          await page.keyboard.press("Escape");
          await page.setViewportSize({ width, height: 844 });
        }
        assert.deepEqual(result.errors, []);
        result.passed = true;
      } catch (error) { result.errors.push(error.stack || String(error)); console.error(error); }
      finally { closing = true; await context.close(); }
      console.log(`${width} ${language}: ${result.passed ? "PASS" : "FAIL"}`);
    }
} finally {
  await browser.close();
  if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
}
assert(report.cases.every((entry) => entry.passed), "See report.json for exact failures");
