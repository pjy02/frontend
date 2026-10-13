import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

// Optional local acceptance runner. CI/unit tests do not require Playwright.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43001";
const mockOrigin = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43123";
for (const url of [origin, mockOrigin])
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "Acceptance runs must use local fixtures"
  );
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});
const now = Date.now();
const artifactDir = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifactDir) mkdirSync(artifactDir, { recursive: true });
const cases = [390, 430, 768, 1024, 1280, 1440].flatMap((width) =>
  ["en-US", "zh-CN"].flatMap((language) =>
    ["light", "dark"].map((theme) => [
      width,
      language,
      theme,
      (language === "en-US") === (theme === "light")
        ? "no-preference"
        : "reduce",
    ])
  )
);
const row = {
  id: 1,
  user_id: 7,
  actor_id: 7,
  action: "system.update",
  object: "system",
  object_id: 42,
  source: "admin",
  detail: "Changed DNS settings",
  created_at: now,
  timestamp: now,
  client_ip: "203.0.113.42",
  user_agent: "Mobile acceptance client",
  order_no: "ORDER-42",
  trade_no: "TRADE-42",
  platform: "stripe",
  currency: "EUR",
  amount: 12_800,
  reason: "Order canceled",
  telegram_sender_id: 0,
};

try {
  for (const [width, language, theme, reducedMotion] of cases) {
    await test(`Admin logs ${width}px ${language} ${theme} ${reducedMotion}`, async () => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 500,
        hasTouch: width < 500,
        reducedMotion,
      });
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: theme, url: origin },
      ]);
      await context.addInitScript(
        ({ language, theme }) => {
          localStorage.setItem("language", language);
          localStorage.setItem("theme", theme);
        },
        { language, theme }
      );
      const page = await context.newPage();
      // All non-log API traffic is also redirected to fixtures, even when testing
      // a production build whose compiled base URL differs from the mock origin.
      await page.route("**/v1/**", async (route) => {
        const url = new URL(route.request().url());
        const response = await context.request.fetch(
          `${mockOrigin}${url.pathname.slice(url.pathname.indexOf("/v1/"))}${url.search}`,
          {
            method: route.request().method(),
            data: route.request().postData() || undefined,
          }
        );
        await route.fulfill({ response });
      });
      const requests = [];
      let mode = "normal";
      await page.route("**/v1/admin/log/**", async (route) => {
        const url = new URL(route.request().url());
        requests.push(Object.fromEntries(url.searchParams));
        if (mode === "error" || mode === "forbidden") {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              code: mode === "forbidden" ? 40_005 : 500,
              message: "Acceptance error",
            }),
          });
          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, mode === "loading" ? 700 : 180)
        );
        const size = Number(url.searchParams.get("size") || 10);
        const records = Array.from({ length: size }, (_, index) => ({
          ...row,
          id: index + 1,
          order_no: `ORDER-${index + 1}`,
        }));
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            code: 200,
            data: {
              list: mode === "empty" ? [] : records,
              total: mode === "empty" ? 0 : 100,
            },
          }),
        });
      });
      const title =
        language === "en-US" ? "Unmatched Payment Log" : "未匹配支付日志";
      await page.goto(
        `${origin}/#/dashboard/log/payment-unmatched?date=2026-09-03&user_id=7&page=3&size=20`
      );
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.classList.contains("dark")
        ),
        theme === "dark"
      );
      await page
        .getByText("128.00 EUR", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      assert(
        requests.some(
          (r) =>
            r.start_date === "2026-09-03" &&
            r.end_date === "2026-09-03" &&
            r.page === "3" &&
            r.user_id === "7"
        )
      );
      assert(
        !new URLSearchParams(new URL(page.url()).hash.split("?")[1]).has("date")
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        )
      );
      assert.equal(
        await page.getByRole("button", { name: /^(Refund|退款)$/ }).count(),
        0
      );
      if (artifactDir)
        await page.screenshot({
          path: path.join(
            artifactDir,
            `payment-${width}-${language}-${theme}.png`
          ),
          animations: "disabled",
        });

      // Scroll to a visible order link before leaving; restoring after async data
      // loading must not clamp a previously deep position to skeleton height.
      await page.evaluate(() =>
        window.scrollTo(
          0,
          Math.min(
            600,
            document.documentElement.scrollHeight - innerHeight - 20
          )
        )
      );
      const links = page.getByRole("link", { name: /^ORDER-/ });
      let clicked = false;
      const before = await page.evaluate(() => scrollY);
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        if (box && box.y > 100 && box.y < 800) {
          await link.click();
          clicked = true;
          break;
        }
      }
      assert(clicked, "No visible order link");
      await page.waitForURL(/#\/dashboard\/order/);
      await page.goBack();
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      await page
        .getByText("128.00 EUR", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      // Event-driven loading observation instead of a screenshot-only assertion.
      await page.locator('.admin-pro-table[data-loading="false"]').waitFor();
      const after = await page.evaluate(() => scrollY);
      assert(
        Math.abs(before - after) < 50,
        `Scroll restoration: ${before} -> ${after} at ${width}px`
      );

      // Intentional user scrolling while data is pending cancels deferred restore.
      mode = "loading";
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        if (box && box.y > 100 && box.y < 800) {
          await link.click();
          break;
        }
      }
      await page.waitForURL(/#\/dashboard\/order/);
      await page.goBack();
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      await page.locator('.admin-pro-table[data-loading="true"]').waitFor();
      await page.mouse.wheel(0, -300);
      const userScroll = await page.evaluate(() => scrollY);
      await page.locator('.admin-pro-table[data-loading="false"]').waitFor();
      assert(
        Math.abs(userScroll - (await page.evaluate(() => scrollY))) < 50,
        "User scroll must override the deferred restoration"
      );
      mode = "normal";

      await page.evaluate(() => window.scrollTo(0, 0));
      if (width < 1024)
        await page
          .getByRole("button", {
            name: language === "en-US" ? "More filters" : "更多筛选",
          })
          .click();
      const start = page.getByLabel(
        language === "en-US" ? "Start date" : "开始日期",
        { exact: true }
      );
      const end = page.getByLabel(
        language === "en-US" ? "End date" : "结束日期",
        { exact: true }
      );
      const visibleStart = start.filter({ visible: true });
      const visibleEnd = end.filter({ visible: true });
      const count = requests.length;
      await visibleStart.fill("2099-01-01");
      await page
        .getByRole("alert")
        .filter({
          hasText: language === "en-US" ? "Start date must" : "开始日期不能",
        })
        .waitFor();
      assert.equal(requests.length, count);
      await visibleEnd.fill("2099-02-01");
      await page.waitForResponse(
        (response) =>
          response.url().includes("/log/payment/unmatched/list") &&
          response.url().includes("end_date=2099-02-01")
      );
      assert(
        requests.some(
          (r) =>
            r.page === "1" &&
            r.start_date === "2099-01-01" &&
            r.end_date === "2099-02-01"
        )
      );
      if (width < 1024)
        await page
          .getByRole("button", {
            name: language === "en-US" ? "Done" : "完成",
            exact: true,
          })
          .click();

      await page.goto(`${origin}/#/dashboard/log/admin?start_date=2026-09-01`);
      await page
        .getByText("system.update", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      await page.locator('.admin-pro-table[data-loading="false"]').waitFor();
      assert(
        requests.some((r) => r.start_date === "2026-09-01" && !r.end_date),
        JSON.stringify({ url: page.url(), requests: requests.slice(-6) })
      );
      // Use the keyboard to open a real detail workspace and restore trigger focus.
      if (width < 1024)
        await page
          .getByRole("button", {
            name: language === "en-US" ? "More details" : "更多详情",
          })
          .first()
          .click();
      const detail = page
        .getByRole("button", {
          name: language === "en-US" ? "Detail" : "详情",
          exact: true,
        })
        .filter({ visible: true })
        .first();
      await detail.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog.getByText("Changed DNS settings", { exact: true }).waitFor();
      await dialog.evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations()
            .map((animation) => animation.finished.catch(() => null))
        );
      });
      const box = await dialog.boundingBox();
      assert(box && box.x >= -1 && box.x + box.width <= width + 1);
      if (artifactDir)
        await page.screenshot({
          path: path.join(
            artifactDir,
            `detail-${width}-${language}-${theme}.png`
          ),
          animations: "disabled",
        });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert(
        await detail.evaluate((element) => document.activeElement === element)
      );
      for (const state of ["empty", "error", "forbidden", "loading"]) {
        mode = state;
        await page.reload();
        if (state === "loading")
          await page.locator('.admin-pro-table[data-loading="true"]').waitFor();
        await page.locator('.admin-pro-table[data-loading="false"]').waitFor();
        if (state === "empty")
          assert.equal(
            await page
              .getByText("system.update", { exact: true })
              .filter({ visible: true })
              .count(),
            0
          );
        if (state === "error" || state === "forbidden")
          assert((await page.getByRole("alert").count()) > 0);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1
          )
        );
      }
      await page.goto(`${origin}/#/dashboard`);
      await page
        .getByText("V1.22.0", { exact: true })
        .filter({ visible: true })
        .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      );
      if (artifactDir)
        await page.screenshot({
          path: path.join(
            artifactDir,
            `dashboard-${width}-${language}-${theme}.png`
          ),
          animations: "disabled",
        });
      console.log(
        JSON.stringify({
          width,
          language,
          theme,
          reducedMotion,
          requests: requests.length,
          scroll: { before, after },
          status: "passed",
        })
      );
      await context.close();
    });
  }
} finally {
  await browser.close();
}
