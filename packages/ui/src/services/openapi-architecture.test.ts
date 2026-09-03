import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type SwaggerSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

type SwaggerDocument = {
  definitions: Record<string, SwaggerSchema>;
};

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url))
);
const servicesRoot = path.join(repoRoot, "packages", "ui", "src", "services");
const swaggerRoot = path.join(repoRoot, "docs", "public", "swagger");

const readSwagger = (name: string): SwaggerDocument =>
  JSON.parse(
    readFileSync(path.join(swaggerRoot, `${name}.json`), "utf8")
  ) as SwaggerDocument;

const propertyNames = (schema: SwaggerSchema) =>
  Object.keys(schema.properties ?? {});

describe("generated OpenAPI architecture", () => {
  it("keeps one generated aggregate client for each browser API", () => {
    for (const [project, aggregate] of [
      ["admin", "admin.ts"],
      ["common", "common.ts"],
      ["user", "user.ts"],
    ]) {
      expect(existsSync(path.join(servicesRoot, project, aggregate))).toBe(
        true
      );
    }

    for (const legacyModule of [
      "admin/log.ts",
      "admin/server.ts",
      "admin/system.ts",
      "admin/user.ts",
      "common/auth.ts",
      "common/oauth.ts",
      "user/order.ts",
      "user/portal.ts",
    ]) {
      expect(existsSync(path.join(servicesRoot, legacyModule))).toBe(false);
    }
  });

  it("generates the operational endpoints used by the admin forms", () => {
    const adminClient = readFileSync(
      path.join(servicesRoot, "admin", "admin.ts"),
      "utf8"
    );
    const commonClient = readFileSync(
      path.join(servicesRoot, "common", "common.ts"),
      "utf8"
    );

    for (const functionName of [
      "getMarketingEmailBatchList",
      "postMarketingEmailBatchPreSendCount",
      "postMarketingEmailBatchSend",
      "postMarketingEmailBatchStatus",
      "postMarketingEmailBatchStop",
      "postMarketingQuotaCreate",
      "getMarketingQuotaList",
      "postMarketingQuotaPreCount",
      "getLogSetting",
      "postLogSetting",
    ]) {
      expect(adminClient).toContain(`export async function ${functionName}(`);
    }
    expect(commonClient).toContain(
      "export async function getCommonSiteConfig("
    );
  });

  it("preserves Reality client fingerprint fields in the API contract", () => {
    const protocol = readSwagger("admin").definitions["dto.Protocol"];
    expect(protocol).toBeDefined();
    expect(propertyNames(protocol)).toEqual(
      expect.arrayContaining([
        "fingerprint",
        "reality_private_key",
        "reality_public_key",
        "reality_server_addr",
        "reality_server_port",
        "reality_short_id",
      ])
    );
  });

  it("keeps the operational request and global configuration fields", () => {
    const admin = readSwagger("admin").definitions;
    const common = readSwagger("common").definitions;

    expect(admin["dto.CreateBatchSendEmailTaskRequest"].required).toEqual([
      "content",
      "scope",
      "subject",
    ]);
    expect(propertyNames(admin["dto.CreateBatchSendEmailTaskRequest"])).toEqual(
      expect.arrayContaining([
        "additional",
        "content",
        "interval",
        "limit",
        "register_end_time",
        "register_start_time",
        "scheduled",
        "scope",
        "subject",
      ])
    );
    expect(propertyNames(admin["dto.CreateQuotaTaskRequest"])).toEqual(
      expect.arrayContaining([
        "days",
        "end_time",
        "gift_type",
        "gift_value",
        "is_active",
        "reset_traffic",
        "start_time",
        "subscribers",
      ])
    );
    expect(admin["dto.LogSetting"].required).toEqual([
      "auto_clear",
      "clear_days",
    ]);
    expect(propertyNames(common["dto.GetGlobalConfigResponse"])).toEqual(
      expect.arrayContaining([
        "auth",
        "currency",
        "invite",
        "oauth_methods",
        "site",
        "subscribe",
        "verify",
        "verify_code",
        "web_ad",
      ])
    );
  });
});
