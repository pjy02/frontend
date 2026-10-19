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
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local GET fixtures only");
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(!existsSync(path.join(artifacts, "report.json")), "Do not overwrite previous evidence");
  mkdirSync(artifacts, { recursive: true });
}
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { browser: browser.version(), scope: "Step 1 visual foundation; local GET mock, no real backend writes or physical-device performance claims", cases: [] };
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440").split(",").map(Number);
const contrast = (a, b) => {
  const luminance = (rgb) => rgb.map((byte) => {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

async function check(width, language, theme) {
  const reduced = (width < 768) === (language === "en-US");
  const result = { width, language, theme, reduced, passed: false, errors: [], contrasts: [], screenshots: [] };
  report.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1024, isMobile: width < 500, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference" });
  let closing = false;
  try {
    await context.addCookies([{ name: "theme", value: theme, url: origin }, { name: "Authorization", value: "acceptance-token", url: origin }]);
    await context.addInitScript((language) => { if (location.protocol === "http:") localStorage.setItem("language", language); }, language);
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
        // Retry only a reset loopback transport, never HTTP failures or business writes.
        await route.fulfill({ response: await context.request.get(`${mock}${api}${url.search}`, { maxRetries: 1 }) });
      } catch (error) {
        if (!closing) result.errors.push(String(error));
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-10-18T06:00:00Z"));
    const visit = async (route) => {
      await page.goto(`${origin}/#${route}`);
      await page.locator(".admin-shell").waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${route}: no document overflow`);
    };
    const snapshot = async (name) => {
      if (!artifacts) return;
      // Capture settled hierarchy, not an arbitrary frame of the existing Tab/Dialog transition.
      await page.waitForTimeout(400);
      const file = `${width}-${language}-${theme}-${name}.png`;
      await page.screenshot({ path: path.join(artifacts, file) });
      result.screenshots.push(file);
    };
    await visit("/dashboard/user");
    const user = locale(language, "user");
    const create = page.locator('.admin-page-header__actions button[data-variant="default"]').first();
    await create.waitFor();
    const foundation = await page.evaluate(() => {
      const source = document.querySelector('.admin-page-header__actions button');
      const fixture = document.createElement("section");
      fixture.id = "foundation-css-fixture";
      fixture.style.cssText = "position:fixed;inset:8px auto auto 8px;z-index:99999;background:var(--card);padding:12px;max-width:calc(100vw - 16px);display:grid;gap:8px";
      for (const variant of ["default", "destructive", "link"]) {
        const button = source.cloneNode(true);
        button.id = `foundation-${variant}`;
        button.dataset.slot = "button";
        button.dataset.variant = variant;
        button.removeAttribute("aria-haspopup");
        button.removeAttribute("aria-controls");
        button.className = "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90";
        if (variant === "destructive") button.className = "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm bg-destructive text-white dark:bg-destructive/60 hover:bg-destructive/90";
        if (variant === "link") button.className = "text-primary";
        button.textContent = `CSS fixture: ${variant}`;
        fixture.append(button);
      }
      for (const [tag, className] of [["h2", "admin-section-title"], ["h3", "admin-subsection-title"], ["span", "admin-meta-text"]]) {
        const element = document.createElement(tag);
        element.className = className;
        element.textContent = "Typography fixture 中文说明";
        fixture.append(element);
      }
      document.body.append(fixture);
      return {
        font: getComputedStyle(document.body).fontFamily,
        pageTitle: getComputedStyle(document.querySelector(".admin-page-header__title")).fontSize,
        section: getComputedStyle(fixture.querySelector("h2")).fontSize,
        subsection: getComputedStyle(fixture.querySelector("h3")).fontSize,
        meta: getComputedStyle(fixture.querySelector(".admin-meta-text")).fontSize,
        motion: document.documentElement.dataset.motion,
      };
    });
    assert.match(foundation.font, /Noto Sans SC/);
    assert.match(foundation.font, /Microsoft YaHei/);
    assert.deepEqual([foundation.section, foundation.subsection, foundation.meta], ["16px", "14px", "12px"]);
    assert.equal(foundation.motion, reduced ? "reduced" : "full");
    result.foundation = foundation;
    const colors = async (locator) => locator.evaluate((node) => {
      const rgba = (color) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const css = getComputedStyle(node), overlay = getComputedStyle(node, "::before");
      const text = rgba(css.color), base = rgba(css.backgroundColor);
      const opacity = Number(overlay.opacity || 0);
      const ink = overlay.content === "none" ? base : rgba(overlay.backgroundColor);
      return { text, base, composed: base.map((channel, index) => channel * (1 - opacity) + ink[index] * opacity), opacity };
    });
    for (const variant of ["default", "destructive"]) {
      const button = page.locator(`#foundation-${variant}`);
      for (const state of ["normal", "hover", "pressed"]) {
        await page.mouse.move(width - 2, 2);
        if (state !== "normal") await button.hover();
        if (state === "pressed") await page.mouse.down();
        await page.waitForTimeout(180);
        const color = await colors(button);
        const ratio = contrast(color.text, color.composed);
        result.contrasts.push({ variant, state, ratio, ...color });
        assert(ratio >= 4.5, `${variant} ${state}: contrast ${ratio}`);
        if (state === "pressed") {
          await page.mouse.move(width - 2, 2);
          await page.mouse.up();
        }
      }
    }
    await page.locator("#foundation-css-fixture").evaluate((node) => node.remove());
    await page.mouse.move(width - 2, 2);
    await page.waitForTimeout(180);
    result.actualCreate = [];
    for (const state of ["normal", "hover", "pressed"]) {
      await page.mouse.move(width - 2, 2);
      if (state !== "normal") await create.hover();
      if (state === "pressed") await page.mouse.down();
      await page.waitForTimeout(180);
      const real = await colors(create);
      const ratio = contrast(real.text, real.composed);
      assert(ratio >= 4.5, `Actual create button ${state}: contrast ${ratio}`);
      result.actualCreate.push({ state, ratio, ...real });
      if (state === "pressed") {
        await page.mouse.move(width - 2, 2);
        await page.mouse.up();
      }
    }
    await page.getByRole("button", { name: user.edit, exact: true }).first().click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByRole("tab", { name: user.authMethodsTitle, exact: true }).click();
    const sections = dialog.locator(".admin-profile-detail-section");
    await sections.first().waitFor();
    assert.equal(await sections.locator('[data-slot="card"]').count(), 0, "No nested auth cards");
    const layout = await sections.first().evaluate((section) => {
      const bounds = section.getBoundingClientRect();
      const input = section.querySelector("input").getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, width: bounds.width, inputWidth: input.width, nestedBorders: getComputedStyle(section).borderWidth };
    });
    assert(layout.left >= -1 && layout.right <= width + 1 && layout.inputWidth > 40, "Readable auth form width");
    result.authSection = layout;
    await snapshot("auth-details");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    if (width === 390 || width === 1440) {
      await visit("/dashboard/log/order");
      const log = locale(language, "log");
      if (width < 1024) {
        const components = locale(language, "components");
        await page.getByRole("button", { name: components.table.moreDetails, exact: true }).first().click();
      }
      await page.getByRole("button", { name: log.requestSource.viewDetails, exact: true }).first().click();
      const details = page.getByRole("dialog").last();
      await details.locator(".admin-detail-section").first().waitFor();
      const section = details.locator(".admin-detail-section").first();
      assert.equal(await section.locator(".admin-subsection-title").evaluate((node) => getComputedStyle(node).fontSize), "14px");
      assert.equal(await section.evaluate((node) => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)", "Flat detail section");
      await snapshot("request-details");
      await page.keyboard.press("Escape");
    }
    await visit("/dashboard");
    if (width < 768) {
      result.metricDescription = await page.locator(".dashboard-metric__description").first().evaluate((node) => getComputedStyle(node).fontSize);
      assert.equal(result.metricDescription, "12px");
    }
    await snapshot("dashboard");
    assert.equal(result.errors.length, 0, result.errors.join("\n"));
    result.passed = true;
  } catch (error) {
    result.errors.push(error.stack || String(error));
  } finally {
    closing = true;
    await context.close();
    console.log(JSON.stringify({ width, language, theme, reduced, passed: result.passed, errors: result.errors }));
  }
}

try {
  for (const width of widths) for (const language of ["zh-CN", "en-US"]) for (const theme of ["light", "dark"]) await check(width, language, theme);
} finally {
  await browser.close();
  if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
}
assert(report.cases.every((item) => item.passed), "See foundation acceptance report for failures");
