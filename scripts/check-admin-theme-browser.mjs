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
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local fixtures only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(!existsSync(path.join(artifacts, "report.json")), "Preserve prior evidence");
  mkdirSync(artifacts, { recursive: true });
}
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440").split(",").map(Number);
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { backend: "Local GET mock only; all business writes forbidden", browser: browser.version(), cases: [] };

async function check(width, language, initial, kind = "admin") {
  const id = `${kind}-${width}-${language}-${initial}`;
  const result = { id, passed: false, errors: [], snapshots: [], evidence: [], documents: 0 };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1280, isMobile: width < 500, colorScheme: initial, reducedMotion: "no-preference" });
  let closing = false;
  try {
    await context.addCookies([{ name: "theme", value: initial, url: origin }, ...(kind === "login" ? [] : [{ name: "Authorization", value: "acceptance-token", url: origin }])]);
    await context.addInitScript(({ language, unsupported }) => {
      if (location.protocol !== "http:") return;
      localStorage.setItem("language", language);
      window.__themeTrace = [];
      window.__themeAnimations = [];
      window.__pauseReveal = true;
      const original = document.startViewTransition?.bind(document);
      if (unsupported) document.startViewTransition = undefined;
      else if (original) document.startViewTransition = (update) => {
        if (window.__failSnapshot) throw new Error("Local snapshot failure fixture");
        const trace = { old: document.documentElement.style.colorScheme, menus: document.querySelectorAll('[role="menu"]').length };
        window.__themeTrace.push(trace);
        return original(() => {
          const updated = update();
          trace.next = document.documentElement.style.colorScheme;
          return updated;
        });
      };
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (options?.pseudoElement !== "::view-transition-new(root)") return animate.call(this, frames, options);
        if (window.__failAnimation) throw new Error("Local pseudo-element failure fixture");
        const animation = animate.call(this, frames, options);
        if (window.__pauseReveal) animation.pause();
        const rect = window.__themeTrigger.getBoundingClientRect();
        window.__themeAnimations.push({ animation, frames, options, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, width: innerWidth, height: innerHeight });
        return animation;
      };
    }, { language, unsupported: kind === "unsupported" });
    await context.route("**/v1/**", async (route) => {
      try {
        if (closing) return await route.abort();
        const request = route.request();
        if (request.method() !== "GET") {
          result.errors.push(`Forbidden write: ${request.method()} ${request.url()}`);
          return await route.abort();
        }
        const url = new URL(request.url());
        const api = url.pathname.slice(url.pathname.indexOf("/v1/"));
        await route.fulfill({ response: await context.request.get(`${mock}${api}${url.search}`, { maxRetries: 1 }) });
      } catch (error) {
        if (!closing) result.errors.push(`Fixture: ${error}`);
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) result.documents++; });
    await page.clock.setFixedTime(new Date("2026-10-17T06:00:00Z"));
    await page.goto(`${origin}/#${kind === "login" ? "/" : "/dashboard/servers"}`);
    const text = locale(language, "components");
    const trigger = page.getByRole("button", { name: text.theme.toggle, exact: true });
    await trigger.waitFor();
    if (kind !== "login") await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
    assert.equal(await page.evaluate(() => window.__themeTrace.length), 0, "No reveal on first paint");
    await page.evaluate(() => {
      window.__themeShell = document.querySelector(".admin-shell");
      window.__themeTable = document.querySelector(".admin-pro-table");
    });
    const count = () => page.evaluate(() => window.__themeAnimations.length);
    const select = async (next, keyboard = false, interrupt = false) => {
      await trigger.evaluate((node) => { window.__themeTrigger = node; });
      if (keyboard) { await trigger.focus(); await page.keyboard.press("Enter"); }
      else if (interrupt) {
        // Send an actual pointer into the snapshot, not a forced DOM click.
        const rect = await trigger.boundingBox();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (width < 1280) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      } else await trigger.click();
      const item = page.getByRole("menuitem", { name: text.theme[next], exact: true });
      await item.waitFor();
      if (keyboard) { await item.focus(); await page.keyboard.press("Enter"); }
      else await item.click();
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await page.waitForFunction((target) => document.cookie.includes(`theme=${target}`), next);
    };
    const settled = async (next) => {
      await page.waitForFunction((target) => document.documentElement.classList.contains(target) && !document.documentElement.hasAttribute("data-theme-reveal") && !document.documentElement.hasAttribute("data-theme-capture"), next);
      assert.equal(await page.evaluate(() => document.documentElement.style.colorScheme), next);
    };
    const finish = async () => {
      await page.evaluate(() => { for (const { animation } of window.__themeAnimations) if (animation.playState !== "idle") animation.finish(); });
    };
    const inspectReveal = async (before, name, capture) => {
      await page.waitForFunction((n) => window.__themeAnimations.length === n + 1, before);
      const geometry = await page.evaluate(() => {
        const { frames, options, rect, width, height } = window.__themeAnimations.at(-1);
        return { frames, options, rect, width, height, trace: window.__themeTrace.at(-1) };
      });
      const { frames, options, rect, trace } = geometry;
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      assert.equal(frames[0].clipPath, `circle(0px at ${x}px ${y}px)`);
      const radius = Number(frames[1].clipPath.match(/^circle\((\d+)px/)[1]);
      for (const cornerX of [0, geometry.width]) for (const cornerY of [0, geometry.height]) assert(radius > Math.hypot(cornerX - x, cornerY - y), "Covers every corner");
      assert.equal(options.duration, width < 768 ? 360 : 420);
      assert.equal(trace.menus, 0, "Closed dropdown is not in old snapshot");
      assert.notEqual(trace.old, trace.next, "New theme applied synchronously in update callback");
      result.snapshots.push(geometry);
      if (capture && artifacts) for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        await page.evaluate((progress) => {
          const { animation, options } = window.__themeAnimations.at(-1);
          animation.currentTime = options.duration * progress;
        }, progress);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const filename = `${id}-${name}-${Math.round(progress * 100)}.png`;
        await page.screenshot({ path: path.join(artifacts, filename), animations: "allow" });
        result.evidence.push(filename);
      }
    };
    const opposite = initial === "light" ? "dark" : "light";
    if (kind === "unsupported") {
      await select(opposite, true); await settled(opposite);
      assert.equal(await count(), 0);
    } else {
      let before = await count();
      await select(opposite);
      await inspectReveal(before, "outward", true); await finish(); await settled(opposite);
      before = await count();
      await select(initial, true);
      await inspectReveal(before, "reverse", false); await finish(); await settled(initial);
      assert(await trigger.evaluate((node) => document.activeElement === node), "Focus returns to original icon");
      before = await count();
      await select(initial); await settled(initial);
      assert.equal(await count(), before, "Same theme has no reveal");
      if (kind === "admin") {
        // A second real selection interrupts a paused native transition.
        await select(opposite); await inspectReveal(before, "interrupt-first", false);
        await select(initial, false, true); await inspectReveal(before + 1, "interrupt-latest", false);
        await finish(); await settled(initial);
        assert(await page.evaluate(() => window.__themeTable === document.querySelector(".admin-pro-table") && window.__themeShell === document.querySelector(".admin-shell")), "Theme switching must not remount the table/shell");

        before = await count();
        await page.evaluate(() => { window.__failSnapshot = true; });
        await select(opposite); await settled(opposite);
        assert.equal(await count(), before);
        await page.evaluate(() => { window.__failSnapshot = false; window.__failAnimation = true; });
        await select(initial); await settled(initial);
        assert.equal(await count(), before);
        await page.evaluate(() => { window.__failAnimation = false; });
        await select(opposite); await inspectReveal(before, "cancel-resize", false);
        await page.setViewportSize({ width: width + 1, height: width < 500 ? 844 : 900 });
        await settled(opposite);
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });

        if (width === 390 || width === 1440) {
          await page.evaluate(() => { location.hash = "/dashboard"; });
          await page.locator(".recharts-surface").first().waitFor();
          await page.evaluate(() => { window.__themeChart = document.querySelector(".recharts-surface"); });
          before = await count();
          await select(initial); await inspectReveal(before, "dashboard", false); await finish(); await settled(initial);
          assert(await page.evaluate(() => window.__themeChart === document.querySelector(".recharts-surface")), "Chart canvas must survive theme switching");
          before = await count();
          await select(opposite); await inspectReveal(before, "cancel-route", false);
          if (width < 1024) {
            await page.locator('[data-slot="sidebar-trigger"]').first().focus();
            await page.keyboard.press("Enter");
          }
          const serverLink = page.locator('[data-sidebar="menu-sub-button"][href*="/dashboard/servers"]').first();
          if (await serverLink.evaluate((link) => Boolean(link.closest("[inert]")))) {
            await page.getByRole("button", { name: locale(language, "menu").Infrastructure, exact: true }).focus();
            await page.keyboard.press("Enter");
          }
          await serverLink.focus();
          await page.keyboard.press("Enter");
          await page.waitForFunction(() => location.hash.split("?")[0] === "#/dashboard/servers");
          await settled(opposite);
          await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        }
      }

      // Also let a real, unpaused timeline finish itself (not only frame stepping).
      await page.evaluate(() => { window.__pauseReveal = false; });
      const naturalTarget = await page.evaluate(() => document.documentElement.classList.contains("dark") ? "light" : "dark");
      before = await count();
      await select(naturalTarget); await settled(naturalTarget);
      assert.equal(await count(), before + 1, "Natural playback completes and releases the snapshot");
      result.naturalPlayback = true;

      // Change the OS preference at runtime and verify reduced motion bypasses VT.
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: opposite });
      before = await count();
      await select(initial); await settled(initial);
      await select(opposite); await settled(opposite);
      assert.equal(await count(), before, "Reduced motion has no radial movement");
      await select("system"); await settled(opposite);
      assert.equal(await count(), before, "Equivalent system choice has no animation");
      await page.emulateMedia({ colorScheme: initial }); await settled(initial);
      assert.equal(await count(), before, "Automatic OS changes have no reveal");
      if (kind === "admin" && (width === 390 || width === 1440)) {
        await page.evaluate(() => { location.hash = "/dashboard/servers/new"; });
        const name = page.locator('[role="dialog"] [data-form-field="name"]');
        await name.fill("Unsaved theme regression fixture");
        await page.emulateMedia({ colorScheme: opposite }); await settled(opposite);
        assert.equal(await name.inputValue(), "Unsaved theme regression fixture", "System theme change preserves dialog drafts");
      }
    }
    assert.equal(result.documents, 1, "No document reload");
    assert.deepEqual(result.errors, []);
    result.passed = true;
  } catch (error) {
    result.errors.push(error.stack || String(error));
    console.error(`${id}: ${error.stack || error}`);
    if (artifacts && context.pages()[0]) await context.pages()[0].screenshot({ path: path.join(artifacts, `${id}-failed.png`) }).catch(() => {});
  } finally {
    closing = true;
    await context.close();
  }
  console.log(`${id}: ${result.passed ? "PASS" : "FAIL"}`);
}

async function checkUser(width) {
  const url = process.env.USER_ACCEPTANCE_URL;
  if (!url) return;
  const address = new URL(url);
  assert(address.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname));
  const id = `user-unchanged-${width}`;
  const result = { id, passed: false, errors: [] };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  let closing = false;
  try {
    await context.addCookies([{ name: "theme", value: "light", url }]);
    await context.addInitScript(() => {
      localStorage.setItem("language", "en-US");
      window.__userTransitions = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) document.startViewTransition = (...args) => { window.__userTransitions++; return start(...args); };
    });
    await context.route("**/v1/**", async (route) => {
      if (closing) return route.abort();
      const request = route.request();
      assert.equal(request.method(), "GET", "User theme check must not write business data");
      const api = new URL(request.url());
      await route.fulfill({ response: await context.request.get(`${mock}${api.pathname.slice(api.pathname.indexOf("/v1/"))}${api.search}`) });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.goto(`${url}/#/auth`);
    const text = locale("en-US", "components");
    const trigger = page.getByRole("button", { name: text.theme.toggle, exact: true });
    await trigger.click();
    await page.getByRole("menuitem", { name: text.theme.dark, exact: true }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await trigger.focus(); await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: text.theme.light, exact: true }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains("light"));
    assert.equal(await page.evaluate(() => window.__userTransitions), 0);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("admin-console") || document.documentElement.hasAttribute("data-theme-reveal")), false);
    assert.deepEqual(result.errors, []);
    result.passed = true;
    if (artifacts) await page.screenshot({ path: path.join(artifacts, `${id}.png`) });
  } catch (error) {
    result.errors.push(error.stack || String(error));
    console.error(`${id}: ${error.stack || error}`);
  } finally {
    closing = true;
    await context.close();
  }
  console.log(`${id}: ${result.passed ? "PASS" : "FAIL"}`);
}

try {
  for (const width of widths) for (const [language, theme] of [["en-US", "light"], ["zh-CN", "dark"]]) await check(width, language, theme);
  for (const width of widths.filter((value) => value === 390 || value === 1440)) {
    await check(width, "en-US", "light", "login");
    await check(width, "zh-CN", "dark", "unsupported");
    await checkUser(width);
  }
} finally {
  await browser.close();
  if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
}
assert(report.cases.every((item) => item.passed), JSON.stringify(report.cases.filter((item) => !item.passed), null, 2));
