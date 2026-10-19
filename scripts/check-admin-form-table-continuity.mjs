import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const browser = await chromium.launch();
const report = {
  scope:
    "Local Chromium + intercepted mock writes. No real backend or physical mobile validation.",
  cases: [],
};
try {
  const widths = process.env.CONTINUITY_WIDTHS
    ? process.env.CONTINUITY_WIDTHS.split(",").map(Number)
    : [390, 430, 768, 1024, 1280, 1440];
  const variants = process.env.CONTINUITY_SMOKE ? [0] : [0, 1];
  for (const width of widths)
    for (const variant of variants) {
      const language = variant ? "zh-CN" : "en-US",
        theme = variant ? "dark" : "light";
      const pointerAction =
        process.env.CONTINUITY_TOUCH && width < 1024 ? "tap" : "click";
      const result = {
        width,
        language,
        theme,
        reduced: Boolean(variant),
        passed: false,
        errors: [],
        writes: [],
        checkpoints: [],
      };
      report.cases.push(result);
      const context = await browser.newContext({
        viewport: { width, height: width < 500 ? 844 : 900 },
        hasTouch: width < 1024,
        isMobile: width < 500,
        reducedMotion: variant ? "reduce" : "no-preference",
      });
      let closing = false,
        failNotify = true,
        failRead = false,
        failRemoval = true;
      const text = locale(language, "user"),
        components = locale(language, "components");
      const initial = await context.request.get(
        `${mock}/v1/admin/user/detail?id=7`
      );
      let user = (await initial.json()).data;
      user.auth_methods.push({
        auth_type: "google",
        auth_identifier: "Browser fixture",
        verified: true,
      });
      const userReads = [];
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: theme, url: origin },
      ]);
      await context.addInitScript(
        (language) => localStorage.setItem("language", language),
        language
      );
      const failure = (route) =>
        route.fulfill({
          status: 500,
          json: { code: 500, msg: "Local failure fixture" },
        });
      await context.route("**/v1/**", async (route) => {
        try {
          if (closing) return await route.abort();
          const request = route.request(),
            url = new URL(request.url());
          const api = url.pathname
            .slice(url.pathname.indexOf("/v1/"))
            .replace(/\/$/, "");
          if (request.method() !== "GET") {
            assert(
              [
                "/v1/admin/user/basic",
                "/v1/admin/user/notify",
                "/v1/admin/user/auth_method",
              ].includes(api),
              "No unrelated mutation permitted"
            );
            const body = request.postDataJSON();
            result.writes.push({
              api,
              method: request.method(),
              fields: Object.keys(body),
            });
            if (api.endsWith("/notify") && failNotify) {
              failNotify = false;
              return await failure(route);
            }
            if (api.endsWith("/auth_method") && request.method() === "DELETE") {
              if (failRemoval) {
                failRemoval = false;
                return await failure(route);
              }
              user.auth_methods = user.auth_methods.filter(
                (method) => method.auth_type !== body.auth_type
              );
            } else if (api.endsWith("/auth_method")) {
              user.auth_methods = user.auth_methods.map((method) =>
                method.auth_type === "email"
                  ? { ...method, auth_identifier: body.auth_identifier }
                  : method
              );
            } else {
              user = { ...user, ...body };
              if (api.endsWith("/notify")) failRead = true;
            }
            return await route.fulfill({ json: { code: 200, data: true } });
          }
          if (api === "/v1/admin/user/list") {
            userReads.push(url.search);
            return await route.fulfill({
              json: { code: 200, data: { list: [user], total: 1 } },
            });
          }
          if (api === "/v1/admin/user/detail") {
            if (failRead) return await failure(route);
            return await route.fulfill({ json: { code: 200, data: user } });
          }
          await route.fulfill({
            response: await context.request.get(`${mock}${api}${url.search}`),
          });
        } catch (error) {
          if (!closing) result.errors.push(String(error));
          await route.abort().catch(() => {
            /* Preserve the original failure if the context already closed. */
          });
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on("pageerror", (error) => result.errors.push(error.message));
      try {
        await page.clock.setFixedTime(new Date("2026-10-19T04:00:00Z"));
        await page.goto(`${origin}/#/dashboard/user`);
        await page
          .getByRole("button", { name: text.edit, exact: true })
          .first()
          [pointerAction]();
        const dialog = page.getByRole("dialog");
        const basicTab = dialog.getByRole("tab", {
          name: text.basicInfoTitle,
          exact: true,
        });
        const notifyTab = dialog.getByRole("tab", {
          name: text.notifySettingsTitle,
          exact: true,
        });
        const authTab = dialog.getByRole("tab", {
          name: text.authMethodsTitle,
          exact: true,
        });
        await dialog.getByLabel(text.referralCode).fill("BROWSER-DRAFT");
        await notifyTab[pointerAction]();
        const balance = dialog.getByRole("switch", {
          name: text.balanceNotifications,
          exact: true,
        });
        const wasChecked = await balance.getAttribute("aria-checked");
        await balance[pointerAction]();
        await authTab[pointerAction]();
        const email = dialog.getByLabel(text.email, { exact: true });
        await email.fill("new-browser@example.com");
        await email.evaluate((element) => {
          window.__formTableInput = element;
        });
        await page.setViewportSize({
          width: width < 1024 ? 1440 : 430,
          height: 900,
        });
        assert(
          await email.evaluate(
            (element) => element === window.__formTableInput
          ),
          "Responsive change must retain editor/input identity"
        );
        assert((await email.inputValue()) === "new-browser@example.com");
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        result.checkpoints.push(
          "responsive editor identity and tab drafts retained"
        );
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", {
            name: components.formSafety.discard,
            exact: true,
          })
          [pointerAction]();
        await page
          .getByRole("button", {
            name: components.formSafety.keepEditing,
            exact: true,
          })
          [pointerAction]();
        await basicTab[pointerAction]();
        assert(
          (await dialog.getByLabel(text.referralCode).inputValue()) ===
            "BROWSER-DRAFT",
          "Cancelling a later discard must re-arm earlier tab guards"
        );
        await dialog
          .getByRole("button", { name: text.save, exact: true })
          [pointerAction]();
        await page.waitForFunction(
          () =>
            !document.querySelector(
              '[data-slot="tabs-content"][data-state="active"] button[type="submit"]:disabled'
            )
        );
        assert(
          !(await page.getByRole("alertdialog").count()),
          "Ordinary edit saves once"
        );
        await notifyTab[pointerAction]();
        assert((await balance.getAttribute("aria-checked")) !== wasChecked);
        await dialog
          .getByRole("button", { name: text.save, exact: true })
          [pointerAction]();
        await dialog
          .getByText(components.formSafety.saveFailed, { exact: true })
          .waitFor();
        await dialog
          .getByRole("button", { name: text.save, exact: true })
          [pointerAction]();
        await dialog
          .getByText(components.actions.savedSyncFailed, { exact: true })
          .waitFor();
        const count = result.writes.length;
        failRead = false;
        await dialog
          .getByRole("alert")
          .filter({ hasText: components.actions.savedSyncFailed })
          .getByRole("button", { name: components.table.retry, exact: true })
          [pointerAction]();
        await dialog
          .getByText(components.actions.savedSyncFailed, { exact: true })
          .waitFor({ state: "hidden" });
        assert(
          result.writes.length === count,
          "Read retry cannot submit a second write"
        );
        result.checkpoints.push(
          "ordinary save, failed write, read-only sync retry"
        );
        await authTab[pointerAction]();
        assert((await email.inputValue()) === "new-browser@example.com");
        await dialog
          .getByRole("button", { name: text.update, exact: true })
          [pointerAction]();
        const review = page.getByRole("alertdialog");
        await review.waitFor();
        assert(
          !(await review
            .getByText("new-browser@example.com", { exact: true })
            .count()),
          "Review contains field names only"
        );
        const activeSubmit = page.locator(
          '[data-slot="tabs-content"][data-state="active"] button[type="submit"]'
        );
        assert(
          (await activeSubmit.getAttribute("data-status")) === "idle",
          "Review is not saving"
        );
        await review.evaluate(async (element) => {
          await Promise.all(
            element.getAnimations().map((animation) =>
              animation.finished.catch(() => {
                /* An interrupted visual is a valid settled state. */
              })
            )
          );
        });
        await page.screenshot({
          path: path.join(output, `${width}-${language}-review.png`),
        });
        await review
          .getByRole("button", {
            name: components.formSafety.confirmSave,
            exact: true,
          })
          [pointerAction]();
        await review.waitFor({ state: "hidden" });
        await dialog
          .getByRole("button", { name: text.update, exact: true })
          .waitFor({ state: "visible" });
        await page.waitForFunction(
          () =>
            document.querySelector(
              '[data-slot="tabs-content"][data-state="active"] button[type="submit"]'
            )?.disabled
        );
        await dialog
          .getByRole("button", { name: text.remove, exact: true })
          [pointerAction]();
        await page
          .getByRole("alertdialog")
          .getByRole("button", {
            name: components.actions.confirm,
            exact: true,
          })
          [pointerAction]();
        await page.getByRole("alertdialog").getByRole("alert").waitFor();
        await page
          .getByRole("alertdialog")
          .getByRole("button", {
            name: components.actions.confirm,
            exact: true,
          })
          [pointerAction]();
        await page.getByRole("alertdialog").waitFor({ state: "hidden" });
        await dialog
          .getByRole("button", { name: text.remove, exact: true })
          .waitFor({ state: "hidden" });
        result.checkpoints.push(
          "credential review, confirmed removal failure and retry"
        );
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        const search = page
          .getByRole("textbox")
          .filter({ visible: true })
          .first();
        const reads = userReads.length;
        await search.dispatchEvent("compositionstart");
        await search.fill("节点");
        await page.waitForTimeout(350);
        assert(
          userReads.length === reads,
          "IME composition cannot issue partial requests"
        );
        await search.dispatchEvent("compositionend");
        await page.waitForTimeout(450);
        assert(userReads.length === reads + 1);
        assert(
          await search.evaluate(
            (element) => element === document.activeElement
          ),
          "Search focus retained"
        );
        await search.fill("pending-before-reset");
        await page
          .getByRole("button", {
            name: components.table.views.resetFilters,
            exact: true,
          })
          [pointerAction]();
        await page.waitForTimeout(450);
        assert(
          (await search.inputValue()) === "",
          "Reset cancels the uncommitted search"
        );
        assert(
          !new URLSearchParams(userReads.at(-1)).has("search"),
          "Pending search cannot reapply itself after reset"
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          ),
          "No horizontal document overflow"
        );
        const counts = await page.evaluate(() => ({
          mobile: document.querySelectorAll(".admin-pro-table-mobile").length,
          desktop: document.querySelectorAll(".admin-pro-table-desktop").length,
        }));
        assert(
          counts.mobile + counts.desktop === 1,
          "Only one responsive presentation mounted"
        );
        assert(result.errors.length === 0, result.errors.join("\n"));
        result.checkpoints.push(
          "IME scheduling, focus, single layout and no overflow"
        );
        result.passed = true;
        console.log(`${width}/${language}: passed`);
      } catch (error) {
        result.errors.push(String(error));
        await page
          .screenshot({
            path: path.join(output, `${width}-${language}-failure.png`),
          })
          .catch(() => {
            /* Preserve the original failure if the context already closed. */
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
