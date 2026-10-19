import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
const chunkDelay = Number(process.env.NAV_CHUNK_DELAY_MS || 450);
for (const address of [origin, mock]) {
  const url = new URL(address);
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Loopback only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) { assert(!existsSync(path.join(artifacts, "report.json")), "Preserve evidence"); mkdirSync(artifacts, { recursive: true }); }
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { scope: "Local mock reads only. No backend writes, live backend integration or physical-device performance verification.", cases: [] };
for (const width of (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440").split(",").map(Number)) {
  const language = [390, 768, 1280].includes(width) ? "zh-CN" : "en-US";
  const theme = [390, 1024, 1280].includes(width) ? "dark" : "light";
  const reduced = [430, 1024, 1440].includes(width);
  const result = { width, language, theme, reduced, passed: false, errors: [], motion: [] };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1024, isMobile: width < 500, reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: theme });
  let closing = false, configMode = "error", logMode = "error", slowChunks = false;
  try {
    await context.addCookies([{ name: "Authorization", value: "acceptance-token", url: origin }, { name: "theme", value: theme, url: origin }, { name: "sidebar_state", value: "true", url: origin }]);
    await context.addInitScript((language) => {
      localStorage.setItem("language", language);
      window.__pageMotion = [];
      const animate = HTMLElement.prototype.animate;
      HTMLElement.prototype.animate = function (...args) {
        const pageContent = this.classList.contains("admin-page-transition");
        if (pageContent) window.__pageMotion.push({ heading: this.querySelector("h1")?.textContent, at: performance.now(), path: location.hash });
        const animation = animate.apply(this, args);
        if (pageContent && window.__pausePageMotion) {
          animation.pause();
          animation.currentTime = Number(args[1]?.duration || 200) / 2;
          window.__pausedPageAnimation = animation;
        }
        return animation;
      };
    }, language);
    await context.route("**/*.js", async (route) => { if (slowChunks) await new Promise((resolve) => setTimeout(resolve, chunkDelay)); await route.continue(); });
    await context.route("**/v1/**", async (route) => {
      try {
        if (closing) return await route.abort();
        const request = route.request();
        if (request.method() !== "GET") { result.errors.push(`Unexpected write: ${request.method()} ${request.url()}`); return await route.abort(); }
        const url = new URL(request.url());
        const api = url.pathname.slice(url.pathname.indexOf("/v1/"));
        if (api === "/v1/admin/auth-method/config" && url.searchParams.get("method") === "google") {
          if (configMode === "error") return await route.fulfill({ status: 500, json: { code: 500, msg: "Local read failure" } });
          return await route.fulfill({ json: { code: 200, data: { id: 7, method: "google", enabled: false, config: { client_id: "acceptance-client", client_secret: "acceptance-secret" } } } });
        }
        if (api === "/v1/admin/tool/log") {
          if (logMode === "error") return await route.fulfill({ status: 500, json: { code: 500, msg: "Local read failure" } });
          return await route.fulfill({ json: { code: 200, data: { list: logMode === "empty" ? [] : [{ timestamp: "2026-10-18 12:00:00", message: "Retained acceptance log" }] } } });
        }
        return await route.fulfill({ response: await context.request.get(`${mock}${api}${url.search}`, { maxRetries: 1 }) });
      } catch (error) { if (!closing) result.errors.push(String(error)); await route.abort().catch(() => {}); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    const components = locale(language, "components"), auth = locale(language, "auth-control"), tool = locale(language, "tool"), menu = locale(language, "menu"), nodes = locale(language, "nodes");
    const capture = async (name) => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No document overflow");
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `${width}-${name}.png`) });
    };
    const checkFooter = async (button) => {
      const bounds = await button.boundingBox();
      assert(bounds && bounds.height <= 64 && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1, "Footer action has a usable height and stays in the workspace");
    };
    const visit = async (route) => { await page.goto(`${origin}/#${route}`); await page.locator(".admin-shell").waitFor(); await page.waitForLoadState("networkidle"); };
    await visit("/dashboard/auth-control");
    await page.getByRole("button", { name: new RegExp(auth.google.title) }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('[data-read-phase="error"]').waitFor();
    assert(await dialog.getByRole("button", { name: auth.common.save, exact: true }).isDisabled(), "Unread defaults cannot be saved");
    assert.equal(await dialog.getByLabel(auth.google.clientId, { exact: true }).count(), 0);
    await checkFooter(dialog.getByRole("button", { name: auth.common.save, exact: true }));
    await capture("config-error");
    configMode = "success";
    await dialog.getByRole("button", { name: components.read.retry, exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll("input")].some((input) => input.value === "acceptance-client"));
    await capture("config-ready");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });

    await visit("/dashboard");
    await page.getByRole("button", { name: tool.systemLogs, exact: true }).first().click();
    await dialog.locator('[data-read-phase="error"]').waitFor();
    logMode = "empty";
    await dialog.getByRole("button", { name: components.read.retry, exact: true }).click();
    await dialog.getByRole("heading", { name: components.read.empty, exact: true }).waitFor();
    await capture("logs-empty");
    logMode = "success";
    await dialog.getByRole("button", { name: tool.refreshLogs, exact: true }).click();
    const log = dialog.getByRole("button", { name: "2026-10-18 12:00:00", exact: true });
    await log.waitFor();
    await log.evaluate((element) => { element.dataset.acceptanceIdentity = "retained"; });
    logMode = "error";
    await dialog.getByRole("button", { name: tool.refreshLogs, exact: true }).click();
    await dialog.locator('[data-read-phase="stale"]').waitFor();
    assert.equal(await log.getAttribute("data-acceptance-identity"), "retained");
    await checkFooter(dialog.getByRole("button", { name: tool.refreshLogs, exact: true }));
    await capture("logs-stale");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });

    const sidebarToggle = page.locator(".admin-header").getByRole("button", { name: components.accessibility.toggleSidebar, exact: true });
    const serverLink = page.getByRole("link", { name: menu["Server Management"], exact: true });
    if (!await serverLink.isVisible()) await sidebarToggle.click();
    await serverLink.click();
    await page.waitForURL(/#\/dashboard\/servers$/);
    await page.getByRole("heading", { name: locale(language, "servers").pageTitle, exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.locator(".admin-header").evaluate((element) => { element.dataset.acceptanceIdentity = "shell"; });
    await page.evaluate(() => { window.__pageMotion = []; window.__pausePageMotion = true; });
    slowChunks = true;
    if (width >= 1024) {
      await sidebarToggle.click();
      const trigger = page.getByRole("button", { name: menu.Infrastructure, exact: true });
      await trigger.press("Enter");
      const navigation = page.getByRole("menu", { name: menu.Infrastructure, exact: true });
      await navigation.waitFor();
      await page.getByRole("menuitem", { name: menu["Node Management"], exact: true }).click();
    } else {
      await sidebarToggle.click();
      await page.getByRole("link", { name: menu["Node Management"], exact: true }).click();
    }
    await page.waitForTimeout(chunkDelay > 1000 ? 1100 : 100);
    assert(await page.locator('.admin-header[data-acceptance-identity="shell"]').isVisible(), "Cold navigation retains shell");
    await capture("navigation-intermediate");
    await page.getByRole("heading", { name: nodes.inventoryTitle, exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getByRole("menu").count(), 0, "Navigation closes its menu");
    if (!reduced) {
      const middleOpacity = await page.locator(".admin-page-transition").evaluate((element) => Number(getComputedStyle(element).opacity));
      assert(middleOpacity > 0 && middleOpacity < 1, "Real navigation middle frame is visible");
      assert.equal(await page.locator(".admin-header").evaluate((element) => getComputedStyle(element).opacity), "1", "Shell does not fade with content");
      await capture("navigation-middle");
    }
    await page.evaluate(() => { window.__pausePageMotion = false; window.__pausedPageAnimation?.finish(); });
    result.motion = await page.evaluate(() => window.__pageMotion);
    assert(result.motion.every((frame) => frame.heading === nodes.inventoryTitle), "No entrance animation is consumed on old content or fallback");
    assert.equal(result.motion.length, reduced ? 0 : 1, "Only the new content enters once");
    assert.equal(await page.locator(".admin-header").getAttribute("data-acceptance-identity"), "shell");
    await capture("navigation-ready");
    assert.deepEqual(result.errors, []);
    result.passed = true;
  } catch (error) { result.errors.push(String(error.stack || error)); }
  finally { closing = true; await context.close(); }
  process.stdout.write(`${JSON.stringify({ width, passed: result.passed, errors: result.errors })}\n`);
}
await browser.close();
if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
if (report.cases.some((entry) => !entry.passed)) process.exitCode = 1;
