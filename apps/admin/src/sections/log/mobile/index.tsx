"use client";

import { getLogMobileList as filterMobileLog } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { MessageLogPage } from "@/sections/log/components/message-log-page";

export default function MobileLogPage() {
  const { t } = useTranslation("log");
  return (
    <MessageLogPage
      description={t(
        "description.mobile",
        "Inspect SMS delivery attempts, providers, payloads, and outcomes."
      )}
      load={filterMobileLog}
      title={t("title.mobile", "SMS Log")}
    />
  );
}
