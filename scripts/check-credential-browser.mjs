import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

// Optional browser acceptance against local fixtures only, never a real account.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.USER_ACCEPTANCE_URL || "http://127.0.0.1:43003";
const mockOrigin = process.env.MOCK_API_ORIGIN || "http://127.0.0.1:43124";
for (const url of [origin, mockOrigin])
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "Acceptance runs must use local fixtures"
  );
const artifactDir = process.env.ACCEPTANCE_ARTIFACT_DIR;
if (artifactDir) mkdirSync(artifactDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
});

try {
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    for (const [language, theme] of [
      ["en-US", "dark"],
      ["zh-CN", "light"],
    ]) {
      await test(`Credential dialog ${width}px ${language} ${theme}`, async () => {
        const locale = JSON.parse(
          readFileSync(
            new URL(
              `../apps/user/public/assets/locales/${language}/profile.json`,
              import.meta.url
            ),
            "utf8"
          )
        );
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          isMobile: width < 500,
          hasTouch: width < 500,
          reducedMotion: language === "en-US" ? "reduce" : "no-preference",
        });
        try {
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
          const submitted = [];
          await page.route("**/v1/**", async (route) => {
            const url = new URL(route.request().url());
            const apiPath = url.pathname.slice(url.pathname.indexOf("/v1/"));
            if (apiPath === "/v1/public/user/bind_email") {
              submitted.push(route.request().postDataJSON());
              await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                  code: submitted.length === 1 ? 20_003 : 200,
                  data: {},
                  message: "Acceptance credential rejection",
                }),
              });
              return;
            }
            const response = await context.request.fetch(
              `${mockOrigin}${apiPath}${url.search}`,
              {
                method: route.request().method(),
                data: route.request().postData() || undefined,
              }
            );
            if (
              apiPath === "/v1/common/site/config" ||
              apiPath === "/v1/public/user/info"
            ) {
              const body = await response.json();
              if (apiPath.includes("site/config"))
                body.data.oauth_methods = ["email", "mobile"];
              else
                body.data.auth_methods = [
                  { auth_type: "email", auth_identifier: "person@example.com" },
                ];
              await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(body),
              });
            } else await route.fulfill({ response });
          });
          await page.goto(`${origin}/#/profile`);
          const trigger = page
            .getByRole("button", {
              name: locale.thirdParty.update,
              exact: true,
            })
            .first();
          await trigger.waitFor();
          await trigger.focus();
          await page.keyboard.press("Enter");
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          assert.equal(
            await page.evaluate(() =>
              document.documentElement.classList.contains("dark")
            ),
            theme === "dark"
          );
          const box = await dialog.boundingBox();
          assert(box && box.x >= -1 && box.x + box.width <= width + 1);
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1
            )
          );
          await dialog.locator('input[type="email"]').fill("new@example.com");
          await dialog
            .getByPlaceholder("Enter code...", { exact: true })
            .fill("123456");
          await dialog
            .getByPlaceholder(locale.currentCredential.password, {
              exact: true,
            })
            .fill("old-test-password");
          const confirm = dialog.getByRole("button", {
            name: locale.thirdParty.confirm,
            exact: true,
          });
          await Promise.all([
            page.waitForResponse((r) => r.url().includes("/user/bind_email")),
            confirm.click(),
          ]);
          await confirm.waitFor({ state: "visible" });
          assert(await dialog.isVisible());
          assert.equal(
            await dialog.locator('input[type="email"]').inputValue(),
            "new@example.com"
          );
          assert.equal(submitted[0].password, "old-test-password");
          await dialog
            .getByRole("button", {
              name: locale.currentCredential.useCode.replace(
                "{{email}}",
                "person@example.com"
              ),
            })
            .click();
          await dialog
            .locator('input[autocomplete="one-time-code"]')
            .fill("654321");
          await dialog.locator('input[autocomplete="one-time-code"]').focus();
          await page.keyboard.press("Tab");
          assert(
            await dialog.evaluate((element) =>
              element.contains(document.activeElement)
            )
          );
          if (artifactDir)
            await page.screenshot({
              path: path.join(
                artifactDir,
                `credential-${width}-${language}-${theme}.png`
              ),
              animations: "disabled",
            });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert(
            await trigger.evaluate(
              (element) => document.activeElement === element
            )
          );
          if (width < 500) {
            await trigger.tap();
            await confirm.tap();
          } else {
            await trigger.click();
            await confirm.click();
          }
          await page.waitForURL((url) => !url.hash.includes("/profile"));
          assert.equal(submitted.length, 2);
          assert.equal(submitted[1].current_code, "654321");
          assert.equal(submitted[1].password, undefined);
          assert(
            !(await context.cookies()).some(
              (cookie) => cookie.name === "Authorization"
            )
          );
          console.log(
            JSON.stringify({
              width,
              language,
              theme,
              failedRetry: true,
              localLogout: true,
              status: "passed",
            })
          );
        } catch (error) {
          console.error(error);
          throw error;
        } finally {
          await context.close();
        }
      });
    }
  }
} finally {
  await browser.close();
}
