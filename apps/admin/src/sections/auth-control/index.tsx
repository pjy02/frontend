import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { SettingsItem, SettingsSection } from "@/components/settings-section";
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

  const formSections = [
    {
      title: t("communicationMethods", "Communication Methods"),
      description: t(
        "communicationMethodsDescription",
        "Configure delivery providers used for email and SMS verification."
      ),
      forms: [
        { component: EmailSettingsForm },
        { component: PhoneSettingsForm },
      ],
    },
    {
      title: t("socialAuthMethods", "Social Authentication Methods"),
      description: t(
        "socialAuthMethodsDescription",
        "Manage OAuth providers and their client credentials."
      ),
      forms: [
        { component: AppleForm },
        { component: GoogleForm },
        { component: FacebookForm },
        { component: GithubForm },
        { component: TelegramForm },
      ],
    },
    {
      title: t("deviceAuthMethods", "Device Authentication Methods"),
      description: t(
        "deviceAuthMethodsDescription",
        "Control device-level authentication and binding policies."
      ),
      forms: [{ component: DeviceForm }],
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
