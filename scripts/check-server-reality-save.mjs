// biome-ignore-all lint/suspicious/noMisplacedAssertion: Standalone browser acceptance uses node:assert without a test runner.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const origin = "http://127.0.0.1:43002";
const mock = "http://127.0.0.1:43124";
const output = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(output && !existsSync(path.join(output, "report.json")));
mkdirSync(output, { recursive: true });
const baseline = process.env.EXPECT_PROTOCOL_DISCARD === "1";
const report = {
  scope: "Local Chromium + intercepted writes only; no real backend or device",
  baseline,
  cases: [],
};
const browser = await chromium.launch();
try {
  for (const width of (process.env.ACCEPTANCE_WIDTHS || "390,1440")
    .split(",")
    .map(Number)) {
    const language = width < 500 ? "zh-CN" : "en-US";
    const locale = (ns) =>
      JSON.parse(
        readFileSync(
          new URL(
            `../apps/admin/public/assets/locales/${language}/${ns}.json`,
            import.meta.url
          ),
          "utf8"
        )
      );
    const t = locale("servers");
    const safety = locale("components").formSafety;
    const result = { width, language, passed: false, writes: [], errors: [] };
    report.cases.push(result);
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 500,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    let closing = false;
    let failWrite = false;
    const rows = structuredClone(
      (await (await context.request.get(`${mock}/v1/admin/server/list`)).json())
        .data.list
    );
    try {
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: width < 500 ? "dark" : "light", url: origin },
      ]);
      await context.addInitScript(
        (lng) => localStorage.setItem("language", lng),
        language
      );
      await context.route("**/v1/**", async (route) => {
        if (closing) return route.abort();
        const req = route.request();
        const url = new URL(req.url());
        const api = url.pathname.slice(url.pathname.indexOf("/v1/"));
        if (req.method() === "GET") {
          if (api === "/v1/admin/server/list")
            return route.fulfill({
              json: { code: 200, data: { list: rows, total: rows.length } },
            });
          return route.fulfill({
            response: await context.request.get(`${mock}${api}${url.search}`, {
              maxRetries: 1,
            }),
          });
        }
        assert.equal(
          api,
          "/v1/admin/server/create",
          "Only locally intercepted create is allowed"
        );
        const body = req.postDataJSON();
        // Never record key values even though these are synthetic fixture keys.
        result.writes.push({
          protocolCount: body.protocols?.length,
          failed: failWrite,
        });
        if (failWrite)
          return route.fulfill({
            json: { code: 500, msg: "Synthetic write failure" },
          });
        rows.push({ ...structuredClone(rows[0]), ...body, id: 9002 });
        return route.fulfill({ json: { code: 200, data: { id: 9002 } } });
      });
      await page.goto(`${origin}/#/dashboard/servers/new`);
      const field = (name) => page.locator(`[name="${name}"]`);
      await field("name").fill(`Reality regression ${width}`);
      await field("address").fill("203.0.113.47");
      const trigger = page.locator('[data-form-path="protocols.2"]');
      const toggle = trigger.locator("..").getByRole("switch");
      assert.equal(await toggle.getAttribute("aria-checked"), "false");
      await trigger.click();
      await field("protocols.2.port").fill("443");
      await page.locator('[data-form-field="protocols.2.security"]').click();
      await page.getByRole("option", { name: "Reality", exact: true }).click();
      const fixture = {
        sni: "www.example.com",
        reality_server_addr: "www.example.com",
        reality_server_port: "443",
        reality_private_key: "synthetic-private-key",
        reality_public_key: "synthetic-public-key",
        reality_short_id: "a1b2c3d4",
      };
      for (const [name, value] of Object.entries(fixture))
        await field(`protocols.2.${name}`).fill(value);
      const confirm = async () => {
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t.confirm, exact: true })
          .click();
        const review = page.getByRole("alertdialog");
        await review.waitFor();
        await review
          .getByRole("button", { name: safety.confirmSave, exact: true })
          .click();
      };
      if (baseline) {
        await confirm();
        await page.waitForFunction(
          () => location.hash === "#/dashboard/servers"
        );
        assert.equal(result.writes.length, 1);
        assert.equal(
          rows.at(-1).protocols.length,
          0,
          "Reproduce silently discarded disabled protocol"
        );
        result.observedDiscard = true;
      } else {
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t.confirm, exact: true })
          .click();
        const message = t.validation.disabledProtocolDraft.replace(
          "{{protocol}}",
          "VLESS"
        );
        await page
          .getByRole("alert")
          .getByText(message, { exact: false })
          .waitFor();
        assert(
          await page
            .getByRole("alert")
            .evaluate((element) => element === document.activeElement),
          "Validation summary receives focus instead of leaving a silent failure below the viewport"
        );
        await page.waitForTimeout(250);
        const alertBounds = await page.getByRole("alert").boundingBox();
        const headerBounds = await page
          .locator(".admin-workspace-dialog__header")
          .boundingBox();
        assert(
          alertBounds &&
            headerBounds &&
            headerBounds.y >= -1 &&
            alertBounds.y >= headerBounds.y + headerBounds.height - 1 &&
            alertBounds.y + alertBounds.height < 900,
          "The error summary and fixed header must really stay visible, not only mounted/focused"
        );
        assert.equal(
          result.writes.length,
          0,
          "Block silent data loss before review or write"
        );
        await page.screenshot({
          path: path.join(output, `${width}-disabled-warning.png`),
        });
        await toggle.click();
        failWrite = true;
        await confirm();
        await page.getByText(safety.saveFailed, { exact: true }).waitFor();
        for (const [name, value] of Object.entries(fixture))
          assert.equal(await field(`protocols.2.${name}`).inputValue(), value);
        failWrite = false;
        await confirm();
        await page.waitForFunction(
          () => location.hash === "#/dashboard/servers"
        );
        assert.equal(
          result.writes.length,
          2,
          "One failed write, one explicit retry; no empty or duplicate create"
        );
        const saved = rows.at(-1).protocols;
        assert.equal(saved.length, 1);
        assert.equal(saved[0].type, "vless");
        assert.equal(saved[0].enable, true);
        assert.equal(saved[0].security, "reality");
        assert.equal(saved[0].port, 443);
        assert.equal(saved[0].fingerprint, "chrome");
        for (const [name, value] of Object.entries(fixture))
          assert.equal(String(saved[0][name]), value);
        await page.evaluate(() => {
          location.hash = "/dashboard/servers/9002";
        });
        await field("name").waitFor();
        assert.equal(await toggle.getAttribute("aria-checked"), "true");
        await trigger.click();
        for (const [name, value] of Object.entries(fixture))
          assert.equal(await field(`protocols.2.${name}`).inputValue(), value);
        await page.screenshot({
          path: path.join(output, `${width}-reopened.png`),
        });
        result.reopenedRealityPreserved = true;
      }
      assert.deepEqual(result.errors, []);
      result.passed = true;
      console.log(
        `${width}/${language}: passed${baseline ? " (confirmed old data loss)" : ""}`
      );
    } catch (error) {
      result.failure = String(error);
      result.alerts = await page.locator('[role="alert"]').allTextContents();
      await page
        .screenshot({ path: path.join(output, `${width}-failure.png`) })
        .catch(() => {
          // Preserve the original failure if the page was already closed.
        });
      throw error;
    } finally {
      closing = true;
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2)
  );
}
