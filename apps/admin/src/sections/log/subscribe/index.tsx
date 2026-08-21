"use client";

import { filterSubscribeLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { IpLink } from "@/components/ip-link";
import { UserAgentValue } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { UserDetail, UserSubscribeDetail } from "@/sections/user/user-detail";

export default function SubscribeLogPage() {
  const { t } = useTranslation("log");
  return (
    <LogPage<
      API.SubscribeLog,
      { date?: string; user_id?: number; user_subscribe_id?: number }
    >
      columns={[
        {
          accessorKey: "user",
          header: t("column.user", "User"),
          cell: ({ row }) => <UserDetail id={Number(row.original.user_id)} />,
        },
        {
          accessorKey: "user_subscribe_id",
          header: t("column.subscribe", "Subscribe"),
          cell: ({ row }) => (
            <UserSubscribeDetail
              enabled
              hoverCard
              id={Number(row.original.user_subscribe_id)}
            />
          ),
        },
        {
          accessorKey: "client_ip",
          header: t("column.ip", "IP"),
          cell: ({ row }) => (
            <IpLink
              ip={String(
                (row.original as API.SubscribeLog & { client_ip?: string })
                  .client_ip || ""
              )}
            />
          ),
        },
        {
          accessorKey: "user_agent",
          header: t("column.userAgent", "User Agent"),
          cell: ({ row }) => <UserAgentValue value={row.original.user_agent} />,
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.subscribe",
        "Trace subscription access by user, subscription, client address, and device."
      )}
      filterTypes={{
        date: "string",
        user_id: "number",
        user_subscribe_id: "number",
      }}
      load={(pagination, filter) =>
        filterSubscribeLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
          user_subscribe_id: filter.user_subscribe_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
        {
          key: "user_subscribe_id",
          placeholder: t("column.subscribeId", "Subscribe ID"),
        },
      ]}
      title={t("title.subscribe", "Subscribe Log")}
    />
  );
}
