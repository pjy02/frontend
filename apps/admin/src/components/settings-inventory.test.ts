import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readAdminFile = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const SYSTEM_FORMS = [
  {
    component: "SiteForm",
    file: "../sections/system/basic-settings/site-form.tsx",
    fields: [
      "site_logo",
      "site_name",
      "site_desc",
      "keywords",
      "custom_html",
      "host",
      "custom_data",
    ],
  },
  {
    component: "CurrencyForm",
    file: "../sections/system/basic-settings/currency-form.tsx",
    fields: ["access_key", "currency_unit", "currency_symbol"],
  },
  {
    component: "TosForm",
    file: "../sections/system/basic-settings/tos-form.tsx",
    fields: ["tos_content"],
  },
  {
    component: "PrivacyPolicyForm",
    file: "../sections/system/basic-settings/privacy-policy-form.tsx",
    fields: ["privacy_policy"],
  },
  {
    component: "RegisterForm",
    file: "../sections/system/user-security/register-form.tsx",
    fields: [
      "stop_register",
      "enable_ip_register_limit",
      "ip_register_limit",
      "ip_register_limit_duration",
      "enable_trial",
      "trial_time",
      "trial_subscribe",
      "trial_time_unit",
    ],
  },
  {
    component: "InviteForm",
    file: "../sections/system/user-security/invite-form.tsx",
    fields: ["forced_invite", "referral_percentage", "only_first_purchase"],
  },
  {
    component: "VerifyForm",
    file: "../sections/system/user-security/verify-form.tsx",
    fields: [
      "turnstile_site_key",
      "turnstile_secret",
      "enable_register_verify",
      "enable_login_verify",
      "enable_reset_password_verify",
    ],
  },
  {
    component: "VerifyCodeForm",
    file: "../sections/system/user-security/verify-code-form.tsx",
    fields: [
      "verify_code_expire_time",
      "verify_code_interval",
      "verify_code_limit",
    ],
  },
  {
    component: "LogCleanupForm",
    file: "../sections/system/log-cleanup/log-cleanup-form.tsx",
    fields: ["auto_clear", "clear_days"],
  },
] as const;

const AUTH_CONTROL_FORMS = [
  {
    component: "EmailSettingsForm",
    file: "../sections/auth-control/forms/email-settings-form.tsx",
    fields: [
      "enabled",
      "config.enable_verify",
      "config.enable_domain_suffix",
      "config.domain_suffix_list",
      "config.platform",
      "config.platform_config.host",
      "config.platform_config.port",
      "config.platform_config.ssl",
      "config.platform_config.user",
      "config.platform_config.pass",
      "config.platform_config.account_id",
      "config.platform_config.from",
      "config.platform_config.reply_to",
      "config.verify_email_subject",
      "config.verify_email_template",
      "config.expiration_email_subject",
      "config.expiration_email_template",
      "config.maintenance_email_subject",
      "config.maintenance_email_template",
      "config.traffic_exceed_email_subject",
      "config.traffic_exceed_email_template",
    ],
  },
  {
    component: "PhoneSettingsForm",
    file: "../sections/auth-control/forms/phone-settings-form.tsx",
    fields: [
      "enabled",
      "config.enable_whitelist",
      "config.whitelist",
      "config.platform",
      "config.platform_config.access",
      "config.platform_config.endpoint",
      "config.platform_config.secret",
      "config.platform_config.template_code",
      "config.platform_config.sign_name",
      "config.platform_config.phone_number",
      "config.platform_config.template",
    ],
  },
  {
    component: "AppleForm",
    file: "../sections/auth-control/forms/apple-form.tsx",
    fields: [
      "enabled",
      "config.team_id",
      "config.key_id",
      "config.client_id",
      "config.client_secret",
      "config.redirect_url",
    ],
  },
  {
    component: "GoogleForm",
    file: "../sections/auth-control/forms/google-form.tsx",
    fields: ["enabled", "config.client_id", "config.client_secret"],
  },
  {
    component: "FacebookForm",
    file: "../sections/auth-control/forms/facebook-form.tsx",
    fields: ["enabled", "client_id", "client_secret"],
  },
  {
    component: "GithubForm",
    file: "../sections/auth-control/forms/github-form.tsx",
    fields: ["enabled", "client_id", "client_secret"],
  },
  {
    component: "TelegramForm",
    file: "../sections/auth-control/forms/telegram-form.tsx",
    fields: [
      "enabled",
      "bot_token",
      "webhook_domain",
      "group_chat_id",
      "enable_notify",
    ],
  },
  {
    component: "DeviceForm",
    file: "../sections/auth-control/forms/device-form.tsx",
    fields: [
      "enabled",
      "config.show_ads",
      "config.only_real_device",
      "config.enable_security",
      "config.security_secret",
    ],
  },
] as const;

const SERVER_PROTOCOLS = [
  "shadowsocks",
  "vmess",
  "vless",
  "trojan",
  "hysteria2",
  "tuic",
  "anytls",
  "naive",
  "mieru",
  "shadowsocksr",
  "snell",
  "nowhere",
] as const;

const SERVER_BASE_FIELDS = ["name", "address", "country", "city"] as const;

const SERVER_PROTOCOL_GROUPS = [
  "basic",
  "obfs",
  "transport",
  "security",
  "reality",
  "encryption",
] as const;

const SERVER_CONFIG_FIELDS = [
  "node_secret",
  "node_pull_interval",
  "node_push_interval",
  "traffic_report_threshold",
  "ip_strategy",
  "dns",
  "outbound",
  "block",
] as const;

describe("Admin settings & protocol inventory contract (zero setting loss)", () => {
  it("preserves all 9 System Settings groups and their 33 form fields", () => {
    const systemIndex = readAdminFile("../sections/system/index.tsx");
    for (const entry of SYSTEM_FORMS) {
      expect(systemIndex).toContain(entry.component);
      const source = readAdminFile(entry.file);
      for (const field of entry.fields) {
        expect(
          source.includes(`name="${field}"`) ||
            source.includes(`name='${field}'`)
        ).toBe(true);
      }
    }
  });

  it("preserves all 8 Auth Control groups and their 57 form fields", () => {
    const authIndex = readAdminFile("../sections/auth-control/index.tsx");
    for (const entry of AUTH_CONTROL_FORMS) {
      expect(authIndex).toContain(entry.component);
      const source = readAdminFile(entry.file);
      for (const field of entry.fields) {
        expect(
          source.includes(`name="${field}"`) ||
            source.includes(`name='${field}'`)
        ).toBe(true);
      }
    }
  });

  it("preserves all 12 Server protocols, base fields, protocol groups, and node config fields", () => {
    const constants = readAdminFile("../sections/servers/form-schema/constants.ts");
    for (const protocol of SERVER_PROTOCOLS) {
      expect(constants).toContain(`"${protocol}"`);
    }

    const serverForm = readAdminFile("../sections/servers/server-form.tsx");
    for (const field of SERVER_BASE_FIELDS) {
      expect(serverForm).toContain(`name="${field}"`);
    }
    for (const group of SERVER_PROTOCOL_GROUPS) {
      expect(serverForm).toContain(`"${group}"`);
    }

    const serverConfig = readAdminFile("../sections/servers/server-config.tsx");
    for (const field of SERVER_CONFIG_FIELDS) {
      expect(serverConfig).toContain(`name="${field}"`);
    }
  });
});
