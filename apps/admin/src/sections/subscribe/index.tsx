"use client";

import { Card, CardContent } from "@workspace/ui/components/card";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import ConfigForm from "./config-form";
import { ProtocolForm } from "./protocol-form";

export default function Subscribe() {
  const { t } = useTranslation("subscribe");

  return (
    <div className="space-y-6">
      <PageHeader
        description={t(
          "pageDescription",
          "Configure subscription delivery rules and maintain client-specific templates."
        )}
        eyebrow={t("infrastructure", "Infrastructure")}
        title={t("config.title", "Subscription Configuration")}
      />
      <Card className="admin-infrastructure-panel py-3">
        <CardContent>
          <ConfigForm />
        </CardContent>
      </Card>

      <ProtocolForm />
    </div>
  );
}
