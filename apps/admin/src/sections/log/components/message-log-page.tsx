import type React from "react";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import {
  LogPayloadValue,
  LogStatusChip,
  LogTypeChip,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";

interface MessageLogPageProps {
  title: React.ReactNode;
  description: React.ReactNode;
  load: (params: {
    page: number;
    size: number;
    search?: string;
    date?: string;
  }) => Promise<unknown>;
}

export function MessageLogPage({
  title,
  description,
  load,
}: MessageLogPageProps) {
  const { t } = useTranslation("log");

  return (
    <LogPage<API.MessageLog, { search?: string; date?: string }>
      columns={[
        {
          accessorKey: "platform",
          header: t("column.platform", "Platform"),
          cell: ({ row }) => (
            <LogTypeChip>{row.original.platform || "—"}</LogTypeChip>
          ),
        },
        { accessorKey: "to", header: t("column.to", "To") },
        { accessorKey: "subject", header: t("column.subject", "Subject") },
        {
          accessorKey: "content",
          header: t("column.content", "Content"),
          cell: ({ row }) => (
            <LogPayloadValue
              description={t(
                "payloadDescription",
                "Complete message content recorded for this delivery attempt."
              )}
              title={t("messageContent", "Message content")}
              value={row.original.content}
              viewLabel={t("viewContent", "View content")}
            />
          ),
        },
        {
          accessorKey: "status",
          header: t("column.status", "Status"),
          cell: ({ row }) => {
            if (row.original.status === 1) {
              return (
                <LogStatusChip status="success">
                  {t("sent", "Sent")}
                </LogStatusChip>
              );
            }
            if (row.original.status === 0) {
              return (
                <LogStatusChip status="error">
                  {t("failed", "Failed")}
                </LogStatusChip>
              );
            }
            return (
              <LogStatusChip status="neutral">
                {t("unknown", "Unknown")}
              </LogStatusChip>
            );
          },
        },
        {
          id: "request_source",
          header: t("column.requestSource", "Request source"),
          cell: ({ row }) => <RequestSource metadata={row.original} />,
        },
        {
          accessorKey: "created_at",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.created_at} />,
        },
      ]}
      description={description}
      filterTypes={{ search: "string", date: "string" }}
      load={(pagination, filters) =>
        load({ ...pagination, search: filters.search, date: filters.date })
      }
      params={[{ key: "search" }, { key: "date", type: "date" }]}
      title={title}
    />
  );
}
