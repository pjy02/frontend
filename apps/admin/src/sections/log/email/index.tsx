"use client";

import { getLogEmailList as filterEmailLog } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { MessageLogPage } from "@/sections/log/components/message-log-page";

export default function EmailLogPage() {
  const { t } = useTranslation("log");
  return (
    <MessageLogPage
      description={t(
        "description.email",
        "Inspect email delivery attempts, providers, payloads, and outcomes."
      )}
      load={filterEmailLog}
      title={t("title.email", "Email Log")}
    />
  );
}
