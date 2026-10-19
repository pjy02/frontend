import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const origin = process.env.ADMIN_ACCEPTANCE_URL || "http://127.0.0.1:43002",
  mock = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const url of [origin, mock])
  assert(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
const output = process.env.ACCEPTANCE_ARTIFACT_DIR;
assert(output && !existsSync(path.join(output, "report.json")));
mkdirSync(output, { recursive: true });
const locale = (namespace) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../apps/admin/public/assets/locales/en-US/${namespace}.json`,
        import.meta.url
      ),
      "utf8"
    )
  );
const common = locale("components");
const browser = await chromium.launch();
const report = {
  scope:
    "Local Chromium/mock; all business writes intercepted, not backend/device verification",
  cases: [],
};
try {
  for (const width of [390, 1440])
    for (const resource of ["payment", "multiplier"]) {
      const result = { width, resource, passed: false, errors: [], writes: 0 };
      report.cases.push(result);
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      let readFails = true,
        writeFails = true,
        closing = false;
      const readPath =
        resource === "payment"
          ? "/v1/admin/payment/platform"
          : "/v1/admin/system/get_node_multiplier";
      const writePath =
        resource === "payment"
          ? "/v1/admin/payment"
          : "/v1/admin/system/set_node_multiplier";
      const periods = [
        { start_time: "00:00:00", end_time: "23:59:59", multiplier: 1 },
      ];
      await context.addCookies([
        { name: "Authorization", value: "acceptance-token", url: origin },
        { name: "theme", value: "light", url: origin },
      ]);
      await context.addInitScript(() =>
        localStorage.setItem("language", "en-US")
      );
      await context.route("**/v1/**", async (route) => {
        try {
          if (closing) return await route.abort();
          const req = route.request(),
            url = new URL(req.url());
          const api = url.pathname
            .slice(url.pathname.indexOf("/v1/"))
            .replace(/\/$/, "");
          if (req.method() !== "GET") {
            assert(api === writePath, "No unrelated writes");
            result.writes++;
            if (writeFails) {
              writeFails = false;
              return await route.fulfill({
                status: 500,
                json: { code: 500, msg: "Local write failure" },
              });
            }
            return await route.fulfill({ json: { code: 200, data: true } });
          }
          if (api === readPath) {
            if (readFails)
              return await route.fulfill({
                status: 500,
                json: { code: 500, msg: "Local read failure" },
              });
            return await route.fulfill({
              json: {
                code: 200,
                data:
                  resource === "payment"
                    ? {
                        list: [
                          {
                            platform: "stripe",
                            platform_field_description: {},
                          },
                        ],
                      }
                    : { periods },
              },
            });
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
        const text = locale(resource === "payment" ? "payment" : "servers");
        await page.goto(
          `${origin}/#/dashboard/${resource === "payment" ? "payment" : "servers"}`
        );
        await page
          .getByRole("button", {
            name:
              resource === "payment"
                ? text.edit
                : text.server_config.dynamic_multiplier,
            exact: true,
          })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByText(common.read.failedDescription, { exact: true })
          .waitFor();
        const save = dialog.getByRole("button", {
          name: resource === "payment" ? text.submit : text.actions.save,
          exact: true,
        });
        assert(
          await save.isDisabled(),
          "Unknown configuration cannot be saved"
        );
        readFails = false;
        await dialog
          .getByRole("button", { name: common.read.retry, exact: true })
          .click();
        const input =
          resource === "payment"
            ? dialog.getByLabel(text.name, { exact: true })
            : dialog.locator('input[type="number"]').first();
        await input.fill(
          resource === "payment" ? "Retained payment draft" : "2"
        );
        await page.evaluate(() => {
          window.__reviewExits = [];
          new MutationObserver(() => {
            for (const panel of document.querySelectorAll(
              '[role="alertdialog"][data-state="closed"]'
            )) {
              window.__reviewExits.push(panel.textContent);
            }
          }).observe(document.body, {
            subtree: true,
            attributes: true,
            childList: true,
            attributeFilter: ["data-state"],
          });
        });
        await save.click();
        const review = page.getByRole("alertdialog");
        await review
          .getByRole("button", {
            name: common.formSafety.confirmSave,
            exact: true,
          })
          .click();
        await dialog
          .getByText(common.formSafety.saveFailed, { exact: true })
          .waitFor();
        await page
          .locator('[role="alertdialog"][data-state="closed"]')
          .waitFor({ state: "detached" });
        assert(
          (await input.inputValue()) ===
            (resource === "payment" ? "Retained payment draft" : "2")
        );
        if (width === 390) {
          const bounds = await dialog.boundingBox();
          assert(
            Math.abs(bounds.width - width) <= 1,
            "Phone configuration uses the fullscreen workspace"
          );
        }
        await page.screenshot({
          path: path.join(output, `${resource}-${width}-failed-write.png`),
        });
        await save.click();
        if (width === 1440)
          await page.evaluate(() => {
            const observer = new MutationObserver(() => {
              const panel = document.querySelector(
                '[role="dialog"][data-state="closed"]'
              );
              if (!panel) return;
              window.__configExit = [...panel.querySelectorAll("input")].map(
                (input) => input.value
              );
              observer.disconnect();
            });
            observer.observe(document.body, {
              attributes: true,
              subtree: true,
              attributeFilter: ["data-state"],
            });
          });
        await page
          .getByRole("alertdialog")
          .getByRole("button", {
            name: common.formSafety.confirmSave,
            exact: true,
          })
          .click();
        await dialog.waitFor({ state: "hidden" });
        const reviewExits = await page.evaluate(() => window.__reviewExits);
        assert(
          reviewExits.length > 0 &&
            reviewExits.every(
              (text) =>
                text.includes(common.formSafety.reviewTitle) &&
                !text.includes(common.formSafety.discardTitle)
            ),
          "Review title and field list retained through exit"
        );
        if (width === 1440) {
          const values = await page.evaluate(() => window.__configExit);
          assert(
            values?.includes(
              resource === "payment" ? "Retained payment draft" : "2"
            ),
            "Closing content retains the saved values"
          );
        }
        assert(result.writes === 2, "Exactly one failed attempt and one retry");
        assert(result.errors.length === 0, result.errors.join("\n"));
        result.passed = true;
        console.log(`${resource}/${width}: passed`);
      } catch (error) {
        result.errors.push(String(error));
        await page
          .screenshot({
            path: path.join(output, `${resource}-${width}-failure.png`),
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
