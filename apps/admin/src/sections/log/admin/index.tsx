"use client";

import { getLogAdminList } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { MobileListSummary } from "@/components/mobile-list-summary";
import {
  LogPayloadValue,
  LogTypeChip,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail } from "@/sections/user/user-detail";

type Filters = Omit<API.getLogAdminListParams, "page" | "size" | "date">;

export default function AdminActionLogPage() {
  const { t } = useTranslation("log");
  const actor = (log: API.AdminActionLog) =>
    log.user_id > 0 ? (
      <UserDetail id={log.user_id} />
    ) : (
      t("requestSource.anonymous", "Anonymous or system")
    );
  const object = (log: API.AdminActionLog) =>
    `${log.object || "—"}${log.object_id ? ` · #${log.object_id}` : ""}`;
  const source = (log: API.AdminActionLog) => (
    <div className="grid min-w-0 gap-1">
      <LogTypeChip>{log.source || "—"}</LogTypeChip>
      <RequestSource metadata={{ ...log, actor_id: log.user_id }} />
    </div>
  );
  const detail = (log: API.AdminActionLog) => (
    <LogPayloadValue
      description={t(
        "adminAction.detailDescription",
        "Recorded details of this administrator operation."
      )}
      title={t("adminAction.detailTitle", "Administrator action details")}
      value={log.detail}
      viewLabel={t("detail", "Detail")}
    />
  );

  return (
    <LogPage<API.AdminActionLog, Filters>
      columns={[
        {
          accessorKey: "user_id",
          header: t("column.actor", "Actor"),
          cell: ({ row }) => actor(row.original),
        },
        {
          accessorKey: "action",
          header: t("column.action", "Action"),
          cell: ({ row }) => (
            <LogTypeChip>{row.original.action || "—"}</LogTypeChip>
          ),
        },
        {
          accessorKey: "object",
          header: t("column.object", "Object"),
          cell: ({ row }) => (
            <span
              className="block max-w-64 truncate"
              title={object(row.original)}
            >
              {object(row.original)}
            </span>
          ),
        },
        {
          id: "request_source",
          header: t("column.requestSource", "Request source"),
          cell: ({ row }) => source(row.original),
        },
        {
          accessorKey: "detail",
          header: t("detail", "Detail"),
          cell: ({ row }) => detail(row.original),
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => (
            <DateTimeValue
              value={row.original.timestamp || row.original.created_at}
            />
          ),
        },
      ]}
      description={t(
        "description.adminAction",
        "Audit administrator changes, affected objects and request sources."
      )}
      filterTypes={{ search: "string", user_id: "number" }}
      load={(pagination, filters, { signal }) =>
        getLogAdminList({ ...pagination, ...filters }, { signal })
      }
      mobile={{
        getAriaLabel: (log) =>
          `${t("title.adminAction", "Administrator Action Log")} #${log.id}`,
        render: (log) => (
          <MobileListSummary
            details={[
              {
                label: t("column.requestSource", "Request source"),
                value: source(log),
                wide: true,
              },
              { label: t("detail", "Detail"), value: detail(log), wide: true },
              ...(log.telegram_sender_id
                ? [
                    {
                      label: t("column.telegramSenderId", "Telegram sender ID"),
                      value: log.telegram_sender_id,
                    },
                  ]
                : []),
            ]}
            fields={[
              {
                label: t("column.actor", "Actor"),
                value: actor(log),
                wide: true,
              },
              { label: t("column.source", "Source"), value: log.source || "—" },
              {
                label: t("column.time", "Time"),
                value: (
                  <DateTimeValue value={log.timestamp || log.created_at} />
                ),
              },
            ]}
            subtitle={object(log)}
            title={log.action || "—"}
          />
        ),
      }}
      params={[
        {
          key: "search",
          placeholder: t(
            "adminAction.search",
            "Search actions, objects or details"
          ),
        },
        {
          key: "user_id",
          placeholder: t("column.adminId", "Administrator ID"),
        },
      ]}
      title={t("title.adminAction", "Administrator Action Log")}
    />
  );
}
