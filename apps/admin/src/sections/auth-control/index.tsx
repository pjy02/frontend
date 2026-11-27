import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import {
  type SettingsWorkspaceGroup,
  SettingsWorkspaceShell,
} from "@/components/settings-workspace";
import AppleForm from "./forms/apple-form";
import DeviceForm from "./forms/device-form";
import EmailSettingsForm from "./forms/email-settings-form";
import FacebookForm from "./forms/facebook-form";
import GithubForm from "./forms/github-form";
import GoogleForm from "./forms/google-form";
import PhoneSettingsForm from "./forms/phone-settings-form";
import TelegramForm from "./forms/telegram-form";

export default function AuthControl() {
  const { t } = useTranslation("auth-control");

  const groups: SettingsWorkspaceGroup[] = [
    {
      id: "communication-methods",
      title: t("communicationMethods", "Communication Methods"),
      description: t(
        "communicationMethodsDescription",
        "Configure delivery providers used for email and SMS verification."
      ),
      items: [
        {
          id: "email",
          title: t("email.title", "Email Settings"),
          description: t(
            "email.description",
            "Configure email authentication and templates"
          ),
          icon: "mdi:email-outline",
          component: EmailSettingsForm,
        },
        {
          id: "phone",
          title: t("phone.title", "SMS Settings"),
          description: t(
            "phone.description",
            "Configure phone number registration, login and SMS services"
          ),
          icon: "mdi:phone-settings",
          component: PhoneSettingsForm,
        },
      ],
    },
    {
      id: "social-auth",
      title: t("socialAuthMethods", "Social Authentication Methods"),
      description: t(
        "socialAuthMethodsDescription",
        "Manage OAuth providers and their client credentials."
      ),
      items: [
        {
          id: "apple",
          title: t("apple.title", "Apple Sign-In"),
          description: t(
            "apple.description",
            "Configure Apple Sign-In authentication settings"
          ),
          icon: "mdi:apple",
          component: AppleForm,
        },
        {
          id: "google",
          title: t("google.title", "Google Sign-In"),
          description: t(
            "google.description",
            "Configure Google OAuth authentication settings"
          ),
          icon: "mdi:google",
          component: GoogleForm,
        },
        {
          id: "facebook",
          title: t("facebook.title", "Facebook Sign-In"),
          description: t(
            "facebook.description",
            "Configure Facebook OAuth authentication settings"
          ),
          icon: "mdi:facebook",
          component: FacebookForm,
        },
        {
          id: "github",
          title: t("github.title", "GitHub Sign-In"),
          description: t(
            "github.description",
            "Configure GitHub OAuth authentication settings"
          ),
          icon: "mdi:github",
          component: GithubForm,
        },
        {
          id: "telegram",
          title: t("telegram.title", "Telegram Sign-In"),
          description: t(
            "telegram.description",
            "Configure Telegram authentication settings"
          ),
          icon: "mdi:telegram",
          component: TelegramForm,
        },
      ],
    },
    {
      id: "device-auth",
      title: t("deviceAuthMethods", "Device Authentication Methods"),
      description: t(
        "deviceAuthMethodsDescription",
        "Control device-level authentication and binding policies."
      ),
      items: [
        {
          id: "device",
          title: t("device.title", "Device Sign-In"),
          description: t(
            "device.description",
            "Configure device identifier authentication settings"
          ),
          icon: "mdi:devices",
          component: DeviceForm,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={t(
          "pageDescription",
          "Manage communication providers, external identity, and device authentication."
        )}
        eyebrow={t("platform", "Platform")}
        title={t("pageTitle", "Authentication Control")}
      />
      <SettingsWorkspaceShell
        defaultId="email"
        directoryLabel={t("pageTitle", "Authentication Control")}
        groups={groups}
      />
    </div>
  );
}
