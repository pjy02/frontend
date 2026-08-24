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
  created_at: 1_724_544_000_000,
  updated_at: 1_724_544_000_000,
};

const subscribeFixture = {
  id: 11,
  show: true,
  sell: true,
  name: "Global Premium annual plan with a long localized product name",
  unit_price: 12_800,
  unit_time: "Year",
  replacement: 2000,
  traffic: 1_099_511_627_776,
  device_limit: 8,
  inventory: 75,
  quota: 3,
  language: "zh-CN / en-US",
  sold: 426,
};

const now = 1_755_734_400_000;

const orderFixture = {
  id: 31,
  order_no: "PPANEL-20260821-VERY-LONG-ORDER-NUMBER-00031",
  trade_no: "TRADE-20260821-ACCEPTANCE-00031",
  type: 1,
  subscribe_id: 11,
  quantity: 1,
  amount: 12_800,
  price: 15_800,
  discount: 2000,
  coupon_discount: 1000,
  fee_amount: 0,
  user_id: 7,
  updated_at: now,
  status: 2,
  payment: { name: "Stripe", platform: "stripe" },
};

const couponFixture = {
  id: 21,
  enable: true,
  name: "Summer migration campaign for returning customers",
  code: "RETURNING-CUSTOMER-2026",
  type: 1,
  discount: 15,
  count: 1000,
  used_count: 384,
  start_time: now - 604_800_000,
  expire_time: now + 2_592_000_000,
};

const paymentFixture = {
  id: 16,
  enable: true,
  icon: "",
  name: "Stripe international card payment",
  platform: "stripe",
  notify_url:
    "https://payments.example.com/v1/callback/stripe/long-mobile-validation-path",
  fee_mode: 1,
  fee_percent: 2.9,
  fee_amount: 0,
};

const ticketFixture = {
  id: 51,
  title: "Cannot connect after subscription renewal on a mobile device",
  description:
    "The connection fails after renewal. Please check the node configuration and account status.",
  user_id: 7,
  status: 1,
  follow: [],
  created_at: now - 3_600_000,
  updated_at: now - 600_000,
};

const logFixture = {
  id: 61,
  user_id: 7,
  server_id: 42,
  user_subscribe_id: 101,
  email: "mobile.acceptance@example.com",
  telephone: "+86 138 0000 0000",
  subject: "Mobile acceptance log with long descriptive text",
  content: "A deliberately long log message used to verify wrapping on phones.",
  login_ip: "2001:db8:1234:5678::42",
  ip: "2001:db8:1234:5678::42",
  user_agent:
    "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140",
  upload: 1_288_490_188,
  download: 6_442_450_944,
  traffic: 7_730_941_132,
  amount: 2000,
  status: 1,
  success: true,
  created_at: now,
  timestamp: now,
};

const consoleServerFixture = {
  online_users: 37,
  online_servers: 5,
  offline_servers: 1,
  today_upload: 18_253_611_008,
  today_download: 62_814_388_224,
  monthly_upload: 421_906_317_312,
  monthly_download: 1_387_670_876_160,
  updated_at: now,
  server_traffic_ranking_today: [
    {
      server_id: 42,
      name: "Tokyo Edge",
      upload: 6_442_450_944,
      download: 18_253_611_008,
    },
    {
      server_id: 43,
      name: "Singapore Core",
      upload: 5_368_709_120,
      download: 14_495_514_624,
    },
    {
      server_id: 44,
      name: "Frankfurt Transit",
      upload: 3_221_225_472,
      download: 10_737_418_240,
    },
    {
      server_id: 45,
      name: "Los Angeles Premium",
      upload: 2_147_483_648,
      download: 8_589_934_592,
    },
  ],
  server_traffic_ranking_yesterday: [
    {
      server_id: 42,
      name: "Tokyo Edge",
      upload: 5_368_709_120,
      download: 15_032_385_536,
    },
    {
      server_id: 43,
      name: "Singapore Core",
      upload: 5_905_580_032,
      download: 16_106_127_360,
    },
    {
      server_id: 44,
      name: "Frankfurt Transit",
      upload: 2_147_483_648,
      download: 8_589_934_592,
    },
    {
      server_id: 45,
      name: "Los Angeles Premium",
      upload: 2_684_354_560,
      download: 7_516_192_768,
    },
  ],
  user_traffic_ranking_today: [
    { uid: 7, sid: 101, upload: 2_684_354_560, download: 9_663_676_416 },
    { uid: 8, sid: 102, upload: 2_147_483_648, download: 7_516_192_768 },
    { uid: 9, sid: 103, upload: 1_610_612_736, download: 5_905_580_032 },
  ],
  user_traffic_ranking_yesterday: [
    { uid: 7, sid: 101, upload: 2_147_483_648, download: 7_516_192_768 },
    { uid: 8, sid: 102, upload: 2_684_354_560, download: 8_589_934_592 },
    { uid: 9, sid: 103, upload: 1_073_741_824, download: 4_294_967_296 },
  ],
};

const revenueDay = (date, amount, newAmount, renewalAmount) => ({
  date,
  amount_total: amount,
  new_order_amount: newAmount,
  renewal_order_amount: renewalAmount,
});

const userDay = (date, register, newOrderUsers, renewalOrderUsers) => ({
  date,
  register,
  new_order_users: newOrderUsers,
  renewal_order_users: renewalOrderUsers,
});

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

  if (url.pathname === "/v1/admin/console/server") {
    send(response, 200, { code: 200, data: consoleServerFixture });
    return;
  }

  if (url.pathname === "/v1/admin/console/revenue") {
    send(response, 200, {
      code: 200,
      data: {
        today: revenueDay("2026-08-21", 38_600, 25_800, 12_800),
        monthly: {
          ...revenueDay("2026-08", 486_900, 321_500, 165_400),
          list: [
            revenueDay("2026-08-15", 29_400, 18_600, 10_800),
            revenueDay("2026-08-16", 35_200, 22_400, 12_800),
            revenueDay("2026-08-17", 31_800, 21_000, 10_800),
            revenueDay("2026-08-18", 42_600, 28_600, 14_000),
            revenueDay("2026-08-19", 39_900, 25_500, 14_400),
            revenueDay("2026-08-20", 45_800, 30_000, 15_800),
            revenueDay("2026-08-21", 38_600, 25_800, 12_800),
          ],
        },
        all: revenueDay("all", 5_486_900, 3_621_500, 1_865_400),
      },
    });
    return;
  }

  if (url.pathname === "/v1/admin/console/user") {
    send(response, 200, {
      code: 200,
      data: {
        today: userDay("2026-08-21", 12, 8, 5),
        monthly: {
          ...userDay("2026-08", 184, 96, 57),
          list: [
            userDay("2026-08-15", 18, 10, 5),
            userDay("2026-08-16", 21, 12, 6),
            userDay("2026-08-17", 17, 8, 5),
            userDay("2026-08-18", 26, 14, 7),
            userDay("2026-08-19", 23, 11, 8),
            userDay("2026-08-20", 28, 15, 9),
            userDay("2026-08-21", 12, 8, 5),
          ],
        },
        all: userDay("all", 4812, 2430, 1642),
      },
    });
    return;
  }

  if (url.pathname === "/v1/admin/console/ticket") {
    send(response, 200, { code: 200, data: { count: 3 } });
    return;
  }

  if (url.pathname === "/v1/auth/login") {
    send(response, 200, {
      code: 200,
      data: { token: "admin-acceptance-token" },
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
    const requestedId = Number(url.searchParams.get("id")) || userFixture.id;
    const requestedUser =
      requestedId === userFixture.id
        ? userFixture
        : {
            ...userFixture,
            id: requestedId,
            auth_methods: [
              {
                auth_type: "email",
                auth_identifier: `user-${requestedId}@example.com`,
                verified: true,
              },
            ],
          };
    send(response, 200, { code: 200, data: requestedUser });
    return;
  }

  const listFixtures = new Map([
    ["/v1/admin/subscribe/list", subscribeFixture],
    ["/v1/admin/order/list", orderFixture],
    ["/v1/admin/coupon/list", couponFixture],
    ["/v1/admin/payment/list", paymentFixture],
    ["/v1/admin/ticket/list", ticketFixture],
  ]);
  const fixture = listFixtures.get(url.pathname);
  if (fixture) {
    send(response, 200, {
      code: 200,
      data: { list: [fixture], total: 1 },
    });
    return;
  }

  if (/^\/v1\/admin\/log\/.+\/list$/.test(url.pathname)) {
    send(response, 200, {
      code: 200,
      data: { list: [logFixture], total: 1 },
    });
    return;
  }

  if (url.pathname === "/v1/admin/ticket/detail") {
    send(response, 200, { code: 200, data: ticketFixture });
    return;
  }

  send(response, 200, { code: 200, data: {} });
}).listen(port, "127.0.0.1", () => {
  console.log(`Admin acceptance mock API listening on ${port}`);
});
