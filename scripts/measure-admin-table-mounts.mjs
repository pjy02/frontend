import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002";
const mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const address of [origin, mock])
  assert(["127.0.0.1", "localhost"].includes(new URL(address).hostname));
const output = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(output && !existsSync(path.join(output, "report.json")));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const report = {
  stage: process.env.PERFORMANCE_STAGE,
  environment:
    "Local Chromium/mock, 4x CPU throttle, not physical mobile measurements",
  samples: [],
};
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addCookies([
      { name: "Authorization", value: "acceptance-token", url: origin },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("language", "en-US")
    );
    await context.route("**/v1/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      // biome-ignore lint/suspicious/noMisplacedAssertion: Standalone browser safety gate.
      assert.equal(req.method(), "GET", "No real business writes permitted");
      const response = await context.request.get(
        `${mock}${url.pathname}${url.search}`
      );
      if (url.pathname === "/v1/admin/user/list") {
        const body = await response.json();
        return route.fulfill({
          json: {
            code: 200,
            data: {
              total: 100,
              list: Array.from({ length: 100 }, (_, i) => ({
                ...body.data.list[0],
                id: i + 7,
              })),
            },
          },
        });
      }
      await route.fulfill({ response });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const started = Date.now();
    await page.goto(`${origin}/#/dashboard/user?size=100`);
    await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .waitFor();
    const sample = await page.evaluate(() => ({
      desktopRows: document.querySelectorAll("tbody .admin-pro-table-row")
        .length,
      mobileCards: document.querySelectorAll(".admin-pro-table-card").length,
      editTriggers: document.querySelectorAll('button[aria-label="Edit"]')
        .length,
      nodes: document.querySelectorAll(".admin-pro-table *").length,
    }));
    const metrics = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map(
        ({ name, value }) => [name, value]
      )
    );
    report.samples.push({
      width,
      ...sample,
      readyMs: Date.now() - started,
      scriptMs: metrics.ScriptDuration * 1000,
      heapMB: metrics.JSHeapUsedSize / 1_048_576,
    });
    // biome-ignore lint/suspicious/noMisplacedAssertion: Standalone browser acceptance.
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2)
  );
}
console.log(JSON.stringify(report));
