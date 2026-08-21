import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { SettingsItem, SettingsSection } from "@/components/settings-section";
import EmailBroadcastForm from "./email/broadcast-form";
import EmailTaskManager from "./email/task-manager";
import QuotaBroadcastForm from "./quota/broadcast-form";
import QuotaTaskManager from "./quota/task-manager";

export default function MarketingPage() {
  const { t } = useTranslation("marketing");

  const formSections = [
    {
      title: t("emailMarketing", "Email Marketing"),
      description: t(
        "emailMarketingDescription",
        "Create targeted email broadcasts and monitor delivery tasks."
      ),
      forms: [
        { component: EmailBroadcastForm },
        { component: EmailTaskManager },
      ],
    },
    {
      title: t("quotaService", "Quota Service"),
      description: t(
        "quotaServiceDescription",
        "Distribute account quota or traffic adjustments and track execution."
      ),
      forms: [
        { component: QuotaBroadcastForm },
        { component: QuotaTaskManager },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={t(
          "pageDescription",
          "Plan outbound campaigns, calculate recipients, and monitor background tasks."
        )}
        eyebrow={t("operations", "Operations")}
        title={t("pageTitle", "Marketing")}
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
