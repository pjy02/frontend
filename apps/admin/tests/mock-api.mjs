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
    send(response, 200, { code: 200, data: { list: [], total: 0 } });
    return;
  }

  if (url.pathname === "/v1/admin/server/node/tags") {
    send(response, 200, { code: 200, data: [] });
    return;
  }

  if (url.pathname === "/v1/admin/user/current") {
    send(response, 200, {
      code: 200,
      data: { id: 1, email: "admin@example.com", name: "Admin" },
    });
    return;
  }

  send(response, 200, { code: 200, data: {} });
}).listen(port, "127.0.0.1", () => {
  console.log(`Admin acceptance mock API listening on ${port}`);
});
