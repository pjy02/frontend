import { readFileSync } from "node:fs";
import {
  getLogAdminList,
  getLogBalanceList,
  getLogCommissionList,
  getLogEmailList,
  getLogGiftList,
  getLogLoginList,
  getLogMobileList,
  getLogOrderList,
  getLogPaymentUnmatchedList,
  getLogRegisterList,
  getLogServerTrafficList,
  getLogSubscribeList,
  getLogSubscribeResetList,
  getLogSubscribeTrafficList,
  getLogTrafficDetails,
  postToolRestart,
} from "@workspace/ui/services/admin/admin";
import {
  getCommonSiteConfig,
  postAuthOauthLogin,
  postAuthOauthLoginToken,
  postCommonSendCode,
  postCommonSendSmsCode,
} from "@workspace/ui/services/common/common";
import {
  putV1PublicUserBindEmail,
  putV1PublicUserBindMobile,
  putV1PublicUserPassword,
} from "@workspace/ui/services/user/user";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@workspace/ui/lib/request", () => ({ default: request }));

const adminSwagger = JSON.parse(
  readFileSync(
    new URL("../../../../docs/public/swagger/admin.json", import.meta.url),
    "utf8"
  )
);

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: { code: 200 } });
  vi.stubEnv("VITE_API_PREFIX", "/api");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("v1.22 browser API compatibility", () => {
  it("restarts through POST as required by Swagger", async () => {
    const path = "/v1/admin/tool/restart";
    expect(adminSwagger.paths[path].post).toBeDefined();
    expect(adminSwagger.paths[path].get).toBeUndefined();

    await postToolRestart();

    expect(request).toHaveBeenCalledWith(`/api${path}`, {
      method: "POST",
    });
  });

  it.each([
    ["balance/list", getLogBalanceList],
    ["commission/list", getLogCommissionList],
    ["email/list", getLogEmailList],
    ["gift/list", getLogGiftList],
    ["login/list", getLogLoginList],
    ["mobile/list", getLogMobileList],
    ["order/list", getLogOrderList],
    ["register/list", getLogRegisterList],
    ["server/traffic/list", getLogServerTrafficList],
    ["subscribe/list", getLogSubscribeList],
    ["subscribe/reset/list", getLogSubscribeResetList],
    ["subscribe/traffic/list", getLogSubscribeTrafficList],
    ["traffic/details", getLogTrafficDetails],
    ["admin/list", getLogAdminList],
    ["payment/unmatched/list", getLogPaymentUnmatchedList],
  ] as const)("preserves range and legacy date parameters for %s", async (suffix, load) => {
    const path = `/v1/admin/log/${suffix}`;
    const parameterNames = adminSwagger.paths[path].get.parameters.map(
      (parameter: { name: string }) => parameter.name
    );
    expect(parameterNames).toEqual(
      expect.arrayContaining(["date", "start_date", "end_date"])
    );
    const pagination = { page: 2, size: 20 };

    for (const filter of [
      { start_date: "2026-10-01", end_date: "2026-10-12" },
      { date: "2026-10-12" },
    ]) {
      const params = { ...pagination, ...filter };
      await load(params);
      expect(request).toHaveBeenLastCalledWith(`/api${path}`, {
        method: "GET",
        params,
      });
    }
  });

  it("preserves the existing common configuration function name and route", async () => {
    await getCommonSiteConfig();

    expect(request).toHaveBeenCalledWith("/api/v1/common/site/config", {
      method: "GET",
    });
  });

  it("sends both supported credential proofs when changing a password", async () => {
    for (const body of [
      { password: "new-test-password", old_password: "current-test-password" },
      { password: "first-test-password", current_code: "123456" },
    ]) {
      await putV1PublicUserPassword(body);
      expect(request).toHaveBeenLastCalledWith(
        "/api/v1/public/user/password",
        expect.objectContaining({ method: "PUT", data: body })
      );
    }
  });

  it("includes new and current address verification when replacing bindings", async () => {
    const email = {
      email: "new@example.com",
      code: "123456",
      current_code: "654321",
    };
    await putV1PublicUserBindEmail(email);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/public/user/bind_email",
      expect.objectContaining({ method: "PUT", data: email })
    );

    const mobile = {
      area_code: "86",
      mobile: "13800000000",
      code: "123456",
      password: "current-test-password",
    };
    await putV1PublicUserBindMobile(mobile);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/public/user/bind_mobile",
      expect.objectContaining({ method: "PUT", data: mobile })
    );
  });

  it("passes Turnstile tokens to email and SMS code requests", async () => {
    const email = {
      email: "test@example.com",
      type: 1,
      cf_token: "test-token",
    } as const;
    await postCommonSendCode(email);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/common/send_code",
      expect.objectContaining({ method: "POST", data: email })
    );

    const sms = {
      telephone: "13800000000",
      telephone_area_code: "86",
      type: 1,
      cf_token: "test-token",
    } as const;
    await postCommonSendSmsCode(sms);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/common/send_sms_code",
      expect.objectContaining({ method: "POST", data: sms })
    );
  });

  it("preserves the nonce on OAuth initiation and token exchange", async () => {
    const start = { method: "google", nonce: "test-sign-in-nonce-1234" };
    await postAuthOauthLogin(start);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/auth/oauth/login",
      expect.objectContaining({ method: "POST", data: start })
    );

    const finish = { ...start, callback: { code: "test-callback-code" } };
    await postAuthOauthLoginToken(finish);
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/auth/oauth/login/token",
      expect.objectContaining({ method: "POST", data: finish })
    );
  });
});
