// biome-ignore-all lint/style/noDoneCallback: node:test passes a TestContext used for browser cleanup.
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const origin = "http://fixture.test";
const root = fileURLToPath(new URL("../", import.meta.url));
const plan = {
  id: 1,
  name: "Smoke Plan",
  show: true,
  sell: true,
  price: 1000,
  unit_time: "Month",
  unit_time_value: 1,
  description: "{}",
};
const otherPlan = { ...plan, id: 2, name: "Second Plan" };
const ip = "2001:db8::42";
const firstServer = {
  id: 1,
  name: "Other server",
  address: "192.0.2.2",
  status: { status: "offline", online: [] },
  protocols: [{ type: "vless", enable: true, port: 443 }],
};
const secondServer = {
  ...firstServer,
  id: 2,
  name: "HK-isvoro",
  address: ip,
  status: undefined,
};
const node = {
  id: 1,
  name: "Other node",
  address: firstServer.address,
  port: 443,
  protocol: "vless",
  server_id: 1,
  tags: [],
  enabled: true,
  sort: 10,
};
const nodes = [
  node,
  {
    ...node,
    id: 2,
    name: "HK-isvoro node",
    address: ip,
    server_id: 2,
    sort: 30,
  },
  {
    ...node,
    id: 3,
    name: "Domain node",
    address: "edge.example.com",
    sort: 50,
  },
];
const payment = { id: 5, name: "Fixture pay", platform: "fixture" };
const site = {
  site: { site_name: "Acceptance" },
  auth: {
    email: {
      enable: true,
      enable_domain_suffix: true,
      domain_suffix_list: "example.com",
    },
  },
};
const user = { id: 1, email: "fixture@example.com", username: "Fixture" };
const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PPANEL_SMOKE_BROWSER,
  });
});
after(async () => browser?.close());

async function fixture(t, app, api) {
  const context = await browser.newContext({
    locale: "en-US",
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
  });
  t.after(() => context.close());
  if (app === "admin") {
    await context.addCookies([
      { name: "Authorization", value: "fixture-only", url: origin },
    ]);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.addInitScript(() => {
    localStorage.setItem("language", "en-US");
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value) => sessionStorage.setItem("copied", value),
      },
    });
  });

  const dist = resolve(root, "apps", app, "dist");
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === "js.stripe.com") {
      return route.fulfill({
        contentType: "text/javascript",
        body: "window.Stripe = function() {};",
      });
    }
    if (url.origin !== origin) return route.abort();
    const path = url.pathname.replace(/^\/api(?=\/v1)/, "");
    if (path.startsWith("/v1/")) {
      const result = await api(path, req, url.searchParams);
      if (result?.status) return route.fulfill(result);
      const standard = path.endsWith("/site/config")
        ? app === "admin"
          ? { site: site.site }
          : site
        : path.endsWith("/user/current") || path.endsWith("/user/info")
          ? user
          : { list: [], total: 0 };
      return route.fulfill({
        json: { code: 200, data: result?.data ?? standard },
      });
    }

    const file = resolve(dist, `.${path === "/" ? "/index.html" : path}`);
    if (!file.startsWith(dist + sep)) return route.abort();
    try {
      await access(file);
      return route.fulfill({ path: file, contentType: mime[extname(file)] });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  return page;
}

const unavailable = { status: 503, json: { code: 500 } };

test("guest checkout validates the quote and restores its credential after reload", async (t) => {
  const requests = [];
  let rejectQuote = false;
  let paid = false;
  const page = await fixture(t, "user", (path, request, search) => {
    if (path.endsWith("/portal/subscribe"))
      return { data: { list: [plan, otherPlan] } };
    if (path.endsWith("/portal/payment-method"))
      return { data: { list: [payment] } };
    if (path.endsWith("/portal/pre")) {
      const body = request.postDataJSON();
      requests.push({ step: "quote", body });
      if (rejectQuote && body.coupon === "FIXTURE") return unavailable;
      return { data: { amount: body.subscribe_id * 1000 } };
    }
    if (path.endsWith("/portal/purchase")) {
      return {
        data: { order_no: "fixture-order", checkout_token: "fixture-checkout" },
      };
    }
    if (path.endsWith("/portal/order/status")) {
      requests.push({ step: "status", token: search.get("checkout_token") });
      return {
        data: {
          status: paid ? 5 : 1,
          created_at: Date.now(),
          order_no: "fixture-order",
          payment,
          subscribe: otherPlan,
          quantity: 1,
          amount: 2000,
          token: paid ? "fixture-session" : undefined,
        },
      };
    }
    if (path.endsWith("/portal/order/checkout")) {
      requests.push({
        step: "checkout",
        token: request.postDataJSON().checkout_token,
      });
      return {
        data: { type: "qr", checkout_url: "https://checkout.example.test" },
      };
    }
  });

  await page.goto(`${origin}/#/purchasing?id=1`);
  await page
    .getByPlaceholder("Email", { exact: true })
    .fill("buyer@example.com");
  await page.locator('input[type="password"]').fill("fixture-only-password");
  await page.evaluate(() => {
    location.hash = "/purchasing?id=2";
  });
  await page.getByRole("heading", { name: "Second Plan" }).waitFor();
  rejectQuote = true;
  await page.getByPlaceholder("Enter Coupon").fill("FIXTURE");
  await page.getByText("Could not confirm the current price.").waitFor();
  const buy = page.getByRole("button", { name: "Buy Now" });
  assert.equal(await buy.isDisabled(), true);
  const quote = requests.findLast(({ step }) => step === "quote").body;
  assert.deepEqual(quote, {
    subscribe_id: 2,
    quantity: 1,
    payment: payment.id,
    coupon: "FIXTURE",
  });

  rejectQuote = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await buy.click();
  await page.getByText("Scan to Pay").waitFor();
  await page.reload();
  await page.getByText("Scan to Pay").waitFor();
  for (const step of ["status", "checkout"]) {
    const recorded = requests.filter((entry) => entry.step === step);
    assert.ok(recorded.length >= 2);
    assert.ok(recorded.every(({ token }) => token === "fixture-checkout"));
  }
  assert.ok(!page.url().includes("fixture-checkout"));
  paid = true;
  await page.getByText("Payment Successful").waitFor();
  await page.waitForFunction(() =>
    document.cookie.includes("Authorization=fixture-session")
  );
});

test("server reads recover and copying reports which changes were actually saved", async (t) => {
  let failRead = true;
  const writes = [];
  const page = await fixture(t, "admin", (path, _request, search) => {
    if (path.endsWith("/admin/server/list")) {
      return failRead && search.get("size") === "100"
        ? unavailable
        : { data: { list: [secondServer], total: 1 } };
    }
    if (path.endsWith("/admin/server/node_config")) {
      writes.push("read");
      return {
        data: {
          override: { inherit_dns: false, dns: [{ address: "192.0.2.53" }] },
        },
      };
    }
    if (path.endsWith("/admin/server/create")) writes.push("create");
    if (path.endsWith("/admin/server/node_config/update"))
      writes.push("override");
  });
  await page.goto(`${origin}/#/dashboard/servers/2`);
  await page.getByText("Could not load the server").waitFor();
  failRead = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit Server" }).waitFor();
  await page.goto(`${origin}/#/dashboard/servers`);
  const row = page.getByRole("row").filter({ hasText: secondServer.name });
  await row.getByText("Unknown", { exact: true }).waitFor();
  await row.getByRole("button", { name: "More Actions", exact: false }).click();
  await page.getByText("Copy", { exact: true }).last().click();
  await page
    .getByText("Server created. Node configuration was not copied.")
    .waitFor();
  assert.deepEqual(writes, ["read", "create"]);
});

test("node filters share paginated inventory and never expose filtered sorting", async (t) => {
  let reads = 0;
  let failServers = false;
  let created;
  let inventory = nodes.map((entry) => ({ ...entry }));
  const page = await fixture(t, "admin", (path, request, search) => {
    if (path.endsWith("/admin/server/node/list")) {
      reads += 1;
      const row = inventory[Number(search.get("page")) - 1];
      return { data: { list: row ? [row] : [], total: inventory.length } };
    }
    if (path.endsWith("/admin/server/node/sort")) {
      const updated = inventory.map((entry) => ({ ...entry }));
      for (const { id, sort } of request.postDataJSON().sort) {
        if (updated.some((entry) => entry.id !== id && entry.sort === sort)) {
          return { status: 400, json: { code: 400 } };
        }
        const row = updated.find((entry) => entry.id === id);
        if (row) row.sort = sort;
      }
      inventory = updated.sort((a, b) => a.sort - b.sort);
      return { data: {} };
    }
    if (path.endsWith("/admin/server/list")) {
      if (failServers) return unavailable;
      return { data: { list: [secondServer], total: 1 } };
    }
    if (path.endsWith("/admin/server/node/tags")) return { data: { tags: [] } };
    if (path.endsWith("/admin/server/node/create")) {
      created = request.postDataJSON();
      return { data: { id: 10 } };
    }
  });
  await page.goto(`${origin}/#/dashboard/nodes`);
  const rows = page.getByRole("row");
  await rows.filter({ hasText: "Domain node" }).waitFor();
  assert.equal(reads, 3);
  const handles = page.locator('[aria-roledescription="sortable"]');
  await handles.first().waitFor();
  const first = await handles.nth(0).boundingBox();
  const second = await handles.nth(1).boundingBox();
  assert.ok(first && second);
  const x = first.x + first.width / 2;
  const y = first.y + first.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 4 });
  await page.mouse.move(
    second.x + second.width / 2,
    second.y + second.height / 2,
    {
      steps: 12,
    }
  );
  await page.mouse.up();
  await page.getByText("Sorted successfully").waitFor();
  assert.deepEqual(
    inventory.map(({ id }) => id),
    [2, 1, 3]
  );
  const search = page.getByRole("textbox", { name: "Search", exact: true });
  for (const term of ["HK", "isvoro"]) {
    await search.fill(term);
    await search.press("Enter");
    await rows.filter({ hasText: "Other node" }).waitFor({ state: "hidden" });
    await handles.first().waitFor({ state: "hidden" });
  }
  await search.fill("");
  await search.press("Enter");
  await rows.filter({ hasText: "Domain node" }).waitFor();
  await page.getByText("Address type", { exact: true }).click();
  await page.getByRole("option", { name: "IPv6", exact: true }).click();
  await rows.filter({ hasText: "Domain node" }).waitFor({ state: "hidden" });
  const ipv6 = rows.filter({ hasText: "HK-isvoro node" });
  await ipv6.getByText(`[${ip}]:443`, { exact: true }).waitFor();
  await ipv6.getByRole("button", { name: "Copy node address" }).click();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("copied")),
    `[${ip}]:443`
  );
  await handles.first().waitFor({ state: "hidden" });
  assert.equal(reads, 6);

  await page.getByRole("button", { name: "Create", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Create Node" });
  failServers = true;
  await form.getByRole("button", { name: "Refresh servers" }).click();
  const retry = form.getByRole("button", { name: "Retry", exact: true });
  await retry.waitFor();
  failServers = false;
  await retry.click();
  await retry.waitFor({ state: "hidden" });
  await form.getByText("Select server…", { exact: true }).click();
  await page.getByText(`HK-isvoro (${ip})`, { exact: true }).last().click();
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.equal(created?.address, ip);
  assert.equal(created?.server_id, secondServer.id);
});

test("mail history isolates HTML and blocks automatic external media loads", async (t) => {
  const page = await fixture(t, "admin", (path) => {
    if (path.endsWith("/marketing/email/batch/list")) {
      return {
        data: {
          list: [
            {
              id: 1,
              subject: "Preview fixture",
              status: 2,
              total: 1,
              current: 1,
              content:
                '<p style="color: navy">Isolated preview</p><img src="https://preview.example.test/remote.png" alt="Optional image">',
            },
          ],
          total: 1,
        },
      };
    }
  });
  const external = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "preview.example.test") {
      external.push(request.url());
    }
  });
  await page.goto(`${origin}/#/dashboard/marketing`);
  await page.getByRole("button", { name: /Email Task Manager/i }).click();
  const row = page.getByRole("row").filter({ hasText: "Preview fixture" });
  await row.getByRole("button", { name: "Email Content", exact: true }).click();
  const iframe = page.locator('iframe[title="Email Content"]');
  const content = iframe.contentFrame().getByText("Isolated preview");
  await content.waitFor();
  assert.equal(await iframe.getAttribute("sandbox"), "");
  assert.equal(await iframe.getAttribute("referrerpolicy"), "no-referrer");
  assert.equal(
    await content.evaluate((element) => getComputedStyle(element).color),
    "rgb(0, 0, 128)"
  );
  assert.deepEqual(external, []);
});
