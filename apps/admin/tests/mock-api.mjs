import { createServer } from "node:http";

const port = Number(process.env.MOCK_API_PORT || 43_123);

const serverFixture = {
  id: 42,
  name: "Tokyo edge with an intentionally long operational label",
  country: "Japan",
  city: "Tokyo metropolitan region",
  address: "very-long-edge-hostname-for-layout-validation.example.com",
  protocols: [
    {
      type: "vless",
      enable: true,
      ratio: 1,
      port: 44_443,
    },
  ],
  status: {
    status: "online",
    cpu: 42.5,
    mem: 63.75,
    disk: 78.25,
    online: 18,
  },
  sort: 1,
};

const nodeFixture = {
  id: 84,
  name: "Tokyo VLESS mobile layout verification node",
  server_id: 42,
  protocol: "vless",
  address: "mobile-node-with-a-long-hostname.example.com",
  port: 44_443,
  tags: ["premium", "tokyo", "edge"],
  enabled: true,
  sort: 1,
};

const userFixture = {
  id: 7,
  avatar: "",
  balance: 12_500,
  commission: 230,
  referral_percentage: 10,
  only_first_purchase: false,
  gift_amount: 500,
  telegram: 0,
  refer_code: "GOOGLE7",
  referer_id: 0,
  enable: true,
  enable_balance_notify: true,
  enable_login_notify: true,
  enable_subscribe_notify: true,
  enable_trade_notify: true,
  auth_methods: [
    {
      auth_type: "email",
      auth_identifier: "mobile.acceptance@example.com",
      verified: true,
    },
  ],
  user_devices: [],
  rules: [],
  created_at: 1_724_544_000,
  updated_at: 1_724_544_000,
};

function send(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 204, {});
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname === "/v1/admin/server/list") {
    const mode = url.searchParams.get("search");
    console.log(`server/list mode=${mode || "normal"}`);
    if (mode === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }
    if (mode === "error") {
      send(response, 200, { code: 500, msg: "Acceptance fixture error" });
      return;
    }
    const list = mode === "empty" ? [] : [serverFixture];
    send(response, 200, {
      code: 200,
      data: {
        list,
        total: list.length,
      },
    });
    return;
  }

  if (url.pathname === "/v1/admin/server/node/list") {
    send(response, 200, {
      code: 200,
      data: { list: [nodeFixture], total: 1 },
    });
    return;
  }

  if (url.pathname === "/v1/admin/server/node/tags") {
    send(response, 200, { code: 200, data: [] });
    return;
  }

  if (url.pathname === "/v1/admin/server/node_config") {
    const config = {
      inherit_ip_strategy: true,
      ip_strategy: "prefer_ipv4",
      inherit_dns: true,
      dns: [],
      inherit_block: true,
      block: [],
      inherit_outbound: true,
      outbound: [],
    };
    send(response, 200, {
      code: 200,
      data: { override: config, effective: config },
    });
    return;
  }

  if (url.pathname === "/v1/admin/user/current") {
    send(response, 200, {
      code: 200,
      data: { id: 1, email: "admin@example.com", name: "Admin" },
    });
    return;
  }

  if (url.pathname === "/v1/admin/user/list") {
    send(response, 200, {
      code: 200,
      data: { list: [userFixture], total: 1 },
    });
    return;
  }

  if (url.pathname === "/v1/admin/user/detail") {
    send(response, 200, { code: 200, data: userFixture });
    return;
  }

  send(response, 200, { code: 200, data: {} });
}).listen(port, "127.0.0.1", () => {
  console.log(`Admin acceptance mock API listening on ${port}`);
});
