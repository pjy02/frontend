import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import {
  type SettingsWorkspaceGroup,
  SettingsWorkspaceShell,
} from "@/components/settings-workspace";
import CurrencyForm from "./basic-settings/currency-form";
import PrivacyPolicyForm from "./basic-settings/privacy-policy-form";
import SiteForm from "./basic-settings/site-form";
import TosForm from "./basic-settings/tos-form";
import LogCleanupForm from "./log-cleanup/log-cleanup-form";
import InviteForm from "./user-security/invite-form";
import RegisterForm from "./user-security/register-form";
import VerifyCodeForm from "./user-security/verify-code-form";
import VerifyForm from "./user-security/verify-form";

export default function System() {
  const { t } = useTranslation("system");

  const groups: SettingsWorkspaceGroup[] = [
    {
      id: "basic-settings",
      title: t("basicSettings", "Basic Settings"),
      description: t(
        "basicSettingsDescription",
        "Manage site identity, currency, and public legal content."
      ),
      items: [
        {
          id: "site",
          title: t("site.title", "Site Configuration"),
          description: t(
            "site.description",
            "Configure basic site information, logo, domain and other settings"
          ),
          icon: "mdi:web",
          component: SiteForm,
        },
        {
          id: "currency",
          title: t("currency.title", "Currency Configuration"),
          description: t(
            "currency.description",
            "Configure currency unit, symbol and exchange rate API"
          ),
          icon: "mdi:currency-usd",
          component: CurrencyForm,
        },
        {
          id: "tos",
          title: t("tos.title", "Terms of Service"),
          description: t(
            "tos.description",
            "Configure and edit Terms of Service content"
          ),
          icon: "mdi:file-document-outline",
          component: TosForm,
        },
        {
          id: "privacy",
          title: t("privacyPolicy.title", "Privacy Policy"),
          description: t(
            "privacyPolicy.description",
            "Edit and manage privacy policy content"
          ),
          icon: "mdi:shield-account-outline",
          component: PrivacyPolicyForm,
        },
      ],
    },
    {
      id: "user-security",
      title: t("userSecuritySettings", "User & Security"),
      description: t(
        "userSecuritySettingsDescription",
        "Control registration, invitations, verification, and security policies."
      ),
      items: [
        {
          id: "register",
          title: t("register.title", "Registration Settings"),
          description: t(
            "register.description",
            "Configure user registration related settings"
          ),
          icon: "mdi:account-plus-outline",
          component: RegisterForm,
        },
        {
          id: "invite",
          title: t("invite.title", "Invitation Settings"),
          description: t(
            "invite.description",
            "Configure user invitation and commission settings"
          ),
          icon: "mdi:account-multiple-plus-outline",
          component: InviteForm,
        },
        {
          id: "verify",
          title: t("verify.title", "Security Verification"),
          description: t(
            "verify.description",
            "Configure Turnstile captcha and verification settings"
          ),
          icon: "mdi:shield-check-outline",
          component: VerifyForm,
        },
        {
          id: "verify-code",
          title: t("verifyCode.title", "Verification Code Settings"),
          description: t(
            "verifyCode.description",
            "Configure email verification code expiration, send interval and daily limits"
          ),
          icon: "mdi:message-text-clock-outline",
          component: VerifyCodeForm,
        },
      ],
    },
    {
      id: "log-settings",
      title: t("logSettings", "Log Settings"),
      description: t(
        "logSettingsDescription",
        "Define retention and automatic cleanup for operational logs."
      ),
      items: [
        {
          id: "log-cleanup",
          title: t("logCleanup.title", "Log Cleanup Settings"),
          description: t(
            "logCleanup.description",
            "Configure automatic log cleanup rules and retention period"
          ),
          icon: "mdi:delete-sweep",
          component: LogCleanupForm,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={t(
          "pageDescription",
          "Configure platform-wide behavior, public information, and user security."
        )}
        eyebrow={t("platform", "Platform")}
        title={t("pageTitle", "System Settings")}
      />
      <SettingsWorkspaceShell
        defaultId="site"
        directoryLabel={t("pageTitle", "System Settings")}
        groups={groups}
      />
    </div>
  );
}
