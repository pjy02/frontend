import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { SettingsItem, SettingsSection } from "@/components/settings-section";
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

  const formSections = [
    {
      title: t("basicSettings", "Basic Settings"),
      description: t(
        "basicSettingsDescription",
        "Manage site identity, currency, and public legal content."
      ),
      forms: [
        { component: SiteForm },
        { component: CurrencyForm },
        { component: TosForm },
        { component: PrivacyPolicyForm },
      ],
    },
    {
      title: t("userSecuritySettings", "User & Security"),
      description: t(
        "userSecuritySettingsDescription",
        "Control registration, invitations, verification, and security policies."
      ),
      forms: [
        { component: RegisterForm },
        { component: InviteForm },
        { component: VerifyForm },
        { component: VerifyCodeForm },
      ],
    },
    {
      title: t("logSettings", "Log Settings"),
      description: t(
        "logSettingsDescription",
        "Define retention and automatic cleanup for operational logs."
      ),
      forms: [{ component: LogCleanupForm }],
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
      {formSections.map((section, sectionIndex) => (
        <SettingsSection
          description={section.description}
          key={sectionIndex}
          title={section.title}
        >
          {section.forms.map((form, formIndex) => {
            const FormComponent = form.component;
            return (
              <SettingsItem key={formIndex}>
                <FormComponent />
              </SettingsItem>
            );
          })}
        </SettingsSection>
      ))}
    </div>
  );
}
