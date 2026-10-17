import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Production preview + local fixtures only. All writes stay in browser memory.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const address of [origin, mock]) {
  const url = new URL(address);
  assert(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifacts) {
  assert(!existsSync(path.join(artifacts, "report.json")), "Preserve earlier evidence");
  mkdirSync(artifacts, { recursive: true });
}
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440").split(",").map(Number);
const locale = (language, namespace) => JSON.parse(readFileSync(new URL(`../apps/admin/public/assets/locales/${language}/${namespace}.json`, import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const report = { backend: "Local mock; create/update intercepted in browser memory, no real backend writes", cases: [] };
try {
  for (const width of widths) for (const [language, theme, reducedMotion] of [
    ["en-US", "light", "no-preference"], ["zh-CN", "dark", "reduce"],
  ]) {
    const id = `${width}-${language}-${theme}`;
    const result = { id, passed: false, errors: [], writes: [], cold: [], documentRequests: 0 };
    report.cases.push(result);
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 1280, isMobile: width < 500, reducedMotion });
    let closing = false;
    let localeGate;
    const localeReleases = new Set();
    const releaseLocales = () => {
      for (const release of localeReleases) release();
      localeReleases.clear();
    };
    let releaseWrite;
    let writeMode = "error";
    const servers = structuredClone((await (await context.request.get(`${mock}/v1/admin/server/list`)).json()).data.list);
    const products = structuredClone((await (await context.request.get(`${mock}/v1/admin/subscribe/list`)).json()).data.list);
    try {
      await context.addCookies([{ name: "Authorization", value: "acceptance-token", url: origin }, { name: "theme", value: theme, url: origin }]);
      await context.addInitScript((lng) => { if (location.protocol === "http:") localStorage.setItem("language", lng); }, language);
      await context.route("**/assets/locales/**", async (route) => {
        if (localeGate && new URL(route.request().url()).pathname.endsWith(`/${localeGate}.json`)) {
          result.cold.at(-1).held = true;
          await new Promise((resolve) => { localeReleases.add(resolve); });
        }
        if (closing) return route.abort();
        return route.continue();
      });
      await context.route("**/v1/**", async (route) => {
        try {
          if (closing) return await route.abort();
          const request = route.request();
          const url = new URL(request.url());
          const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/")).replace(/\/$/, "");
          if (request.method() === "GET") {
            const rows = apiPath === "/v1/admin/server/list" ? servers : apiPath === "/v1/admin/subscribe/list" ? products : null;
            if (rows) return await route.fulfill({ json: { code: 200, data: { list: rows, total: rows.length } } });
            return await route.fulfill({ response: await context.request.get(`${mock}${apiPath}${url.search}`, { maxRetries: 1 }) });
          }
          assert(["/v1/admin/server/create", "/v1/admin/server/update", "/v1/admin/subscribe"].includes(apiPath), `Unexpected write ${apiPath}`);
          const data = request.postDataJSON();
          result.writes.push({ path: apiPath, name: data.name, success: writeMode !== "error" });
          if (writeMode === "error") return await route.fulfill({ json: { code: 500, msg: "Local retry fixture" } });
          if (writeMode === "hold") await new Promise((resolve) => { releaseWrite = resolve; });
          if (apiPath.endsWith("/create")) servers.push({ ...structuredClone(servers[0]), ...data, id: 9001, sort: 2, status: { status: "offline", cpu: 0, mem: 0, disk: 0, online: [] } });
          else {
            const rows = apiPath === "/v1/admin/subscribe" ? products : servers;
            const index = rows.findIndex((row) => row.id === data.id);
            assert(index >= 0, "Existing record required");
            rows[index] = { ...rows[index], ...data };
          }
          await route.fulfill({ json: { code: 200, data: {} } });
        } catch (error) {
          if (!closing) result.errors.push(`Fixture: ${error}`);
          await route.abort().catch(() => {});
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.on("pageerror", (error) => result.errors.push(error.message));
      page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) result.documentRequests++; });
      await page.clock.setFixedTime(new Date("2026-10-17T04:00:00Z"));
      await page.goto(`${origin}/#/dashboard/servers`);
      await page.locator(".admin-shell").waitFor();
      await page.getByText(servers[0].name, { exact: true }).filter({ visible: true }).first().waitFor();
      // Sample actual intermediate frames, not just settled screenshots.
      await page.evaluate(() => {
        const shell = document.querySelector(".admin-shell");
        window.__coldShell = shell;
        window.__coldFrames = { count: 0, hidden: 0 };
        const sample = () => {
          window.__coldFrames.count++;
          if (!shell?.isConnected || shell.getBoundingClientRect().height === 0 || getComputedStyle(shell).visibility === "hidden") window.__coldFrames.hidden++;
          window.__coldFrame = requestAnimationFrame(sample);
        };
        sample();
      });
      for (const [namespace, destination] of [["nodes", "/dashboard/nodes"], ["product", "/dashboard/product"]]) {
        const cold = { namespace, held: false };
        result.cold.push(cold);
        localeGate = namespace;
        await page.evaluate((route) => { location.hash = route; }, destination);
        for (let attempt = 0; attempt < 100 && !cold.held; attempt++) await page.waitForTimeout(50);
        await page.waitForFunction(() => document.querySelector(".admin-content [aria-busy=true]") !== null);
        assert(cold.held, "Cold namespace must really be held");
        await page.waitForTimeout(700);
        assert(await page.locator(".admin-shell").isVisible(), "Persistent shell visible during cold load");
        assert(await page.locator("header").first().isVisible(), "Header visible during cold load");
        if (artifacts) await page.screenshot({ path: path.join(artifacts, `${id}-cold-${namespace}.png`) });
        localeGate = undefined;
        releaseLocales();
        await page.locator(".admin-content").getByRole("status", { name: locale(language, "components").loading, exact: true }).waitFor({ state: "hidden" });
        await page.waitForTimeout(350);
      }
      const frames = await page.evaluate(() => {
        cancelAnimationFrame(window.__coldFrame);
        return { ...window.__coldFrames, sameShell: window.__coldShell === document.querySelector(".admin-shell") };
      });
      result.frames = frames;
      assert(frames.count > 10 && frames.hidden === 0 && frames.sameShell, JSON.stringify(frames));
      assert.equal(result.documentRequests, 1, "No document reload on route change");

      const serverText = locale(language, "servers");
      const productText = locale(language, "product");
      const safetyText = locale(language, "components").formSafety;
      const go = async (route) => { await page.evaluate((value) => { location.hash = value; }, route); };
      const field = (name) => page.locator(`[role=dialog] [data-form-field="${name}"]`);
      const confirm = async (label) => {
        await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
        const review = page.getByRole("alertdialog");
        await review.waitFor();
        await review.getByRole("button", { name: safetyText.confirmSave, exact: true }).click();
        await review.waitFor({ state: "hidden" });
      };
      const assertList = async (listPath) => {
        await page.waitForFunction((hash) => location.hash.split("?")[0] === `#${hash}`, listPath);
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      };
      await go("/dashboard/servers/new");
      await field("name").fill(`Saved once ${id}`);
      await field("address").fill("local-fixture.example.com");
      const protocol = page.locator('[data-form-path="protocols.0"]');
      await protocol.getByRole("switch").click();
      if (await protocol.getAttribute("data-state") !== "open") await protocol.click();
      await field("protocols.0.port").fill("12345");
      await confirm(serverText.confirm);
      await page.getByRole("dialog").getByText(safetyText.saveFailed, { exact: true }).waitFor();
      assert.equal(await field("name").inputValue(), `Saved once ${id}`);
      assert.equal(await field("address").inputValue(), "local-fixture.example.com");
      assert.equal(servers.length, 1, "Failed request did not create a server");
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `${id}-retry.png`) });
      writeMode = "hold";
      await confirm(serverText.confirm);
      await page.waitForFunction(() => document.querySelector('[role="dialog"] button:disabled') !== null);
      for (let attempt = 0; attempt < 100 && !releaseWrite; attempt++) await page.waitForTimeout(50);
      assert(releaseWrite, "Successful request is held in flight");
      assert(await page.getByRole("dialog").getByRole("button", { name: serverText.confirm, exact: true }).isDisabled());
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      assert.equal(new URL(page.url()).hash, "#/dashboard/servers/new", "Busy editor cannot be dismissed");
      assert.equal(await field("name").inputValue(), `Saved once ${id}`);
      releaseWrite(); releaseWrite = undefined;
      await assertList("/dashboard/servers");
      assert.equal(servers.length, 2);
      assert.equal(result.writes.length, 2, "One failed request plus one successful request, no duplicate");
      writeMode = "success";
      await go("/dashboard/servers/9001");
      await field("name").waitFor();
      assert.equal(await field("name").inputValue(), `Saved once ${id}`);
      await field("name").fill(`Updated once ${id}`);
      await confirm(serverText.confirm);
      await assertList("/dashboard/servers");
      await go("/dashboard/servers/9001");
      await field("name").waitFor();
      assert.equal(await field("name").inputValue(), `Updated once ${id}`);
      await field("name").fill("Unsaved fixture");
      await page.getByRole("dialog").getByRole("button", { name: serverText.cancel, exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: safetyText.keepEditing, exact: true }).click();
      assert.equal(await field("name").inputValue(), "Unsaved fixture");
      await page.getByRole("dialog").getByRole("button", { name: serverText.cancel, exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: safetyText.discard, exact: true }).click();
      await assertList("/dashboard/servers");
      assert.equal(servers[1].name, `Updated once ${id}`);

      await go(`/dashboard/product/${products[0].id}`);
      await field("name").waitFor();
      await field("name").fill(`Product saved ${id}`);
      await confirm(productText.form.confirm);
      await assertList("/dashboard/product");
      await go(`/dashboard/product/${products[0].id}`);
      await field("name").waitFor();
      assert.equal(await field("name").inputValue(), `Product saved ${id}`);
      assert.equal(result.writes.length, 4);
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `${id}-product-reopened.png`) });
      assert.deepEqual(result.errors, []);
      result.passed = true;
    } catch (error) {
      result.errors.push(error.stack || String(error));
      console.error(`${id}: ${error.stack || error}`);
      const page = context.pages()[0];
      if (page && artifacts) await page.screenshot({ path: path.join(artifacts, `${id}-failed.png`) }).catch(() => {});
    } finally {
      closing = true;
      releaseLocales(); releaseWrite?.();
      await context.close();
    }
    console.log(`${id}: ${result.passed ? "PASS" : "FAIL"}`);
  }
} finally {
  await browser.close();
  if (artifacts) writeFileSync(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2));
}
assert(report.cases.every((item) => item.passed), JSON.stringify(report.cases.filter((item) => !item.passed), null, 2));
