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
      ["localhost", "127.0.0.1"].includes(url.hostname),
    "Local mock only"
  );
}
const artifacts = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(
  artifacts && !existsSync(path.join(artifacts, "report.json")),
  "New artifact directory required"
);
mkdirSync(artifacts, { recursive: true });
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
const widths = (process.env.ACCEPTANCE_WIDTHS || "390,430,768,1024,1280,1440")
  .split(",")
  .map(Number);
const browser = await chromium.launch({ headless: true });
const report = {
  backend: "Local mock only; no real backend or physical device",
  cases: [],
};
const variants = process.env.ACCEPTANCE_SMOKE
  ? [
      ["en-US", "light", "no-preference"],
      ["zh-CN", "dark", "reduce"],
    ]
  : ["zh-CN", "en-US"].flatMap((language) =>
      ["light", "dark"].flatMap((theme) =>
        ["no-preference", "reduce"].map((motion) => [language, theme, motion])
      )
    );
try {
  for (const width of widths)
    for (const [language, theme, reducedMotion] of variants) {
      const id = `${width}-${language}-${theme}-${reducedMotion}`;
      const result = {
        id,
        passed: false,
        errors: [],
        writes: [],
        evidence: [],
        frames: [],
      };
      report.cases.push(result);
      const record =
        width === 390 &&
        theme === "light" &&
        reducedMotion === "no-preference" &&
        (language === "zh-CN" ||
          Boolean(process.env.ACCEPTANCE_TRANSITION_ONLY));
      const context = await browser.newContext({
        viewport: { width, height: width < 500 ? 844 : 900 },
        hasTouch: width < 1280,
        isMobile: width < 500,
        reducedMotion,
        ...(record
          ? {
              recordVideo: {
                dir: path.join(artifacts, "video"),
                size: { width, height: 844 },
              },
            }
          : {}),
      });
      let mode = "normal",
        release,
        closing = false;
      const page = await context.newPage();
      page.setDefaultTimeout(12_000);
      page.on("pageerror", (error) => result.errors.push(error.message));
      try {
        await context.addCookies([
          { name: "Authorization", value: "acceptance-token", url: origin },
          { name: "theme", value: theme, url: origin },
        ]);
        await context.addInitScript((language) => {
          if (location.protocol === "http:")
            localStorage.setItem("language", language);
        }, language);
        await page.clock.setFixedTime(new Date("2026-10-16T06:00:00Z"));
        await context.route("**/v1/**", async (route) => {
          try {
            if (closing) return await route.abort();
            const request = route.request(),
              url = new URL(request.url());
            if (request.method() !== "GET") {
              result.writes.push(`${request.method()} ${url.pathname}`);
              return await route.abort();
            }
            if (url.pathname === "/v1/admin/user/list") {
              if (mode === "loading")
                await new Promise((resolve) => {
                  release = resolve;
                });
              if (closing) return await route.abort();
              if (["error", "forbidden"].includes(mode))
                return await route.fulfill({
                  json: {
                    code: mode === "forbidden" ? 40_005 : 500,
                    msg: "Acceptance fixture",
                  },
                });
              const response = await context.request.get(
                  `${mock}${url.pathname}${url.search}`
                ),
                body = await response.json();
              const all =
                mode === "empty"
                  ? []
                  : Array.from({ length: 120 }, (_, i) => ({
                      ...body.data.list[0],
                      id: i + 7,
                      auth_methods: [
                        {
                          auth_type: "email",
                          auth_identifier: `operator-${i}-with-a-long-operational-address@example.com`,
                          verified: true,
                        },
                      ],
                    }));
              const index = Number(url.searchParams.get("page") || 1),
                size = Number(url.searchParams.get("size") || 10);
              return await route.fulfill({
                json: {
                  code: 200,
                  data: {
                    list: all.slice((index - 1) * size, index * size),
                    total: all.length,
                  },
                },
              });
            }
            const response = await context.request.get(
              `${mock}${url.pathname}${url.search}`
            );
            await route.fulfill({ response });
          } catch (error) {
            if (!closing) result.errors.push(`Mock route: ${error}`);
            await route.abort().catch(() => {});
          }
        });
        const c = locale(language, "components"),
          d = locale(language, "dashboard"),
          u = locale(language, "user");
        const open = async (route) => {
          await page.goto("about:blank");
          await page.goto(`${origin}/#${route}`);
        };
        const settled = () =>
          page.waitForFunction(() => {
            const root = document.querySelector(".admin-page-transition");
            return (
              root &&
              getComputedStyle(root).display !== "none" &&
              Number(getComputedStyle(root).opacity) > 0.99 &&
              !root.getAnimations().some((a) => a.playState === "running")
            );
          });
        const capture = async (name, wait = true) => {
          if (wait) {
            await settled();
            await page.waitForTimeout(120);
          }
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1
            ),
            false,
            `${name}: viewport overflow`
          );
          const filename = `${id}-${name}.png`;
          await page.screenshot({
            path: path.join(artifacts, filename),
            animations: "allow",
          });
          result.evidence.push(filename);
        };
        await open("/dashboard");
        const ranking = page.locator(
          '[data-dashboard-module="trafficRanking"]'
        );
        await ranking.locator(".dashboard-traffic-row").first().waitFor();
        await settled();
        await page.waitForTimeout(750);
        await capture("dashboard");
        // Keep the changing summaries and rows in view, not just the controls
        // above the fold, when recording intermediate frames and video.
        await ranking.evaluate((node) =>
          node.scrollIntoView({ block: "start", behavior: "instant" })
        );
        await page.waitForTimeout(100);
        const samples = page.evaluate(async () => {
          const values = [],
            start = performance.now();
          while (performance.now() - start < 450) {
            await new Promise(requestAnimationFrame);
            const stages = Array.from(
              document.querySelectorAll(
                '[data-dashboard-module="trafficRanking"] [data-dashboard-fade-through]'
              )
            );
            const row = document.querySelector(".dashboard-traffic-row"),
              bar = document.querySelector(".dashboard-traffic-bar");
            values.push({
              elapsed: performance.now() - start,
              opacity: stages.map((n) => Number(getComputedStyle(n).opacity)),
              transform: row ? getComputedStyle(row).transform : null,
              barTransform: bar ? getComputedStyle(bar).transform : null,
            });
          }
          return values;
        });
        await ranking.getByRole("tab", { name: d.users, exact: true }).click();
        await page.waitForTimeout(35);
        await capture("category-middle", false);
        result.frames = await samples;
        for (const frame of result.frames)
          if (frame.opacity.length)
            assert(
              Math.max(...frame.opacity) - Math.min(...frame.opacity) < 0.06,
              "Related summaries and rows share the transition clock"
            );
        if (reducedMotion === "no-preference")
          assert(
            result.frames.some((frame) =>
              frame.opacity.some((value) => value > 0.05 && value < 0.95)
            ),
            "Capture a real intermediate opacity, not just final screenshots"
          );
        await ranking.getByRole("tab", { name: d.nodes, exact: true }).click();
        await ranking.getByRole("tab", { name: d.users, exact: true }).click();
        await ranking.locator('[data-traffic-id^="users-"]').first().waitFor();
        await page.waitForTimeout(350);
        assert.equal(
          await ranking
            .locator('[data-dashboard-transition-key="nodes"]')
            .count(),
          0
        );
        if (reducedMotion === "reduce") {
          assert.equal(
            await page.evaluate(() => document.documentElement.dataset.motion),
            "reduced"
          );
          const transforms = await ranking
            .locator(".dashboard-traffic-row, .dashboard-traffic-bar")
            .evaluateAll((nodes) =>
              nodes.map((n) => getComputedStyle(n).transform)
            );
          assert(
            transforms.every(
              (value) =>
                value === "none" || value === "matrix(1, 0, 0, 1, 0, 0)"
            ),
            "Reduced motion removes ranking translation and scale"
          );
        }
        // Changing the system setting during an animation must settle, not leave opacity/height behind.
        await ranking.getByRole("tab", { name: d.nodes, exact: true }).click();
        await page.waitForTimeout(25);
        await page.emulateMedia({
          reducedMotion:
            reducedMotion === "reduce" ? "no-preference" : "reduce",
        });
        await page.waitForFunction(
          (mode) => document.documentElement.dataset.motion === mode,
          reducedMotion === "reduce" ? "full" : "reduced"
        );
        await page.waitForFunction(() => {
          const ranking = document.querySelector(
            '[data-dashboard-module="trafficRanking"]'
          );
          const stages = Array.from(
            ranking.querySelectorAll("[data-dashboard-fade-through]")
          );
          return (
            ranking.querySelector('[data-dashboard-transition-key="nodes"]') &&
            stages.every(
              (node) => Number(getComputedStyle(node).opacity) > 0.99
            ) &&
            Array.from(
              ranking.querySelectorAll("[data-dashboard-height-region]")
            ).every((node) => !node.style.height)
          );
        });
        await page.emulateMedia({ reducedMotion });
        await page.waitForFunction(
          (mode) => document.documentElement.dataset.motion === mode,
          reducedMotion === "reduce" ? "reduced" : "full"
        );

        if (process.env.ACCEPTANCE_TRANSITION_ONLY) {
          assert.deepEqual(result.errors, []);
          assert.deepEqual(result.writes, []);
          result.passed = true;
          console.log(`PASS transition ${id}`);
          continue;
        }

        mode = "loading";
        await open("/dashboard/user?size=50");
        const table = page.locator(".admin-pro-table");
        await page.locator('.admin-pro-table[aria-busy="true"]').waitFor();
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              ".admin-pro-table-placeholder, tbody .animate-pulse"
            ).length > 0
        );
        await capture("loading");
        mode = "normal";
        release?.();
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const surface = page.locator(
          width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop"
        );
        const rows = table.locator('tbody [data-slot="table-row"]');
        assert.equal(await rows.count(), 50);
        const row = await rows.first().elementHandle();
        const refresh = table.getByRole("button", {
          name: c.table.refresh,
          exact: true,
        });
        await capture("long-list");
        const more = surface
          .getByRole("button", { name: u.moreActions, exact: true })
          .first();
        await more.focus();
        await page.keyboard.press("Enter");
        if (width < 1024) {
          await page
            .getByRole("button", { name: u.logsAndRecords, exact: true })
            .click();
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
          await page.keyboard.press("ArrowRight");
          await page
            .getByRole("menuitem", { name: u.loginLogs, exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
          await page.keyboard.press("Escape");
        }
        await page.waitForFunction(
          (label) =>
            document.activeElement?.getAttribute("title") === label ||
            document.activeElement?.getAttribute("aria-label") === label,
          u.moreActions
        );
        mode = "error";
        await refresh.click();
        await page.locator(".admin-pro-table-stale-alert").waitFor();
        assert(
          await row.evaluate((node) => node.isConnected),
          "Failed refresh retains old row identity"
        );
        await capture("stale");
        mode = "normal";
        await refresh.click();
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        // Route-driven editor must retain the parent list and its scroll offset.
        await open("/dashboard/servers?search=keep-scroll");
        await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
        const servers = page.locator(
          width < 1280 ? ".admin-pro-table-mobile" : ".admin-pro-table-desktop"
        );
        const edit = servers
          .getByRole("link", {
            name: locale(language, "servers").edit,
            exact: true,
          })
          .first();
        await edit.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
          window.__mainNode = document.querySelector(".admin-content");
          window.__tableNode = document.querySelector(".admin-pro-table");
          window.__savedY = {
            main: window.__mainNode.scrollTop,
            page: scrollY,
          };
        });
        await edit.click();
        const dialog = page.getByRole("dialog");
        await dialog.locator('[data-form-field="name"]').waitFor();
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert(
          await page.evaluate(
            () =>
              window.__tableNode ===
                document.querySelector(".admin-pro-table") &&
              Math.abs(window.__mainNode.scrollTop - window.__savedY.main) <
                2 &&
              Math.abs(scrollY - window.__savedY.page) < 2
          ),
          "Closing editor preserves list and scroll"
        );
        assert(
          page.url().includes("search=keep-scroll"),
          "Closing editor retains URL filters"
        );
        const checkbox = servers
          .getByRole("checkbox", { name: c.table.selectRow, exact: true })
          .first();
        await checkbox.click();
        const batch = page.locator(".admin-batch-actions");
        await batch.waitFor();
        await page.evaluate(() => {
          const main = document.querySelector(".admin-content");
          main.scrollTop = 500;
          window.scrollTo(0, 500);
        });
        const rect = await batch.boundingBox();
        assert(
          rect &&
            rect.y >= 0 &&
            rect.y + rect.height <= (width < 500 ? 844 : 900),
          "Batch actions remain in the viewport"
        );
        await checkbox.scrollIntoViewIfNeeded();
        await checkbox.click();
        await batch.waitFor({ state: "hidden" });

        for (const state of ["empty", "error", "forbidden"]) {
          mode = state;
          await open("/dashboard/user");
          await page.locator('.admin-pro-table[aria-busy="false"]').waitFor();
          assert.equal(
            await page.locator("tbody .admin-pro-table-row").count(),
            0
          );
          if (state === "error")
            await page
              .getByText(c.table.loadError, { exact: true })
              .filter({ visible: true })
              .waitFor();
          if (state === "forbidden")
            await page
              .getByText(c.table.permissionDenied, { exact: true })
              .filter({ visible: true })
              .waitFor();
          await capture(state);
        }
        assert.deepEqual(result.errors, []);
        assert.deepEqual(result.writes, []);
        result.passed = true;
        console.log(`PASS ${id}`);
      } catch (error) {
        result.failure = String(error);
        console.error(`FAIL ${id}: ${error}`);
        await page
          .screenshot({ path: path.join(artifacts, `${id}-failure.png`) })
          .catch(() => {});
      } finally {
        closing = true;
        release?.();
        const video = page.video();
        await context.close();
        if (video) result.video = path.relative(artifacts, await video.path());
      }
    }
} finally {
  await browser.close();
  writeFileSync(
    path.join(artifacts, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
}
assert(
  report.cases.every((item) => item.passed),
  "Every state/theme/motion combination must pass"
);
