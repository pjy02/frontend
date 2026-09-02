"use client";

import { getLogTrafficDetails as filterTrafficLogDetails } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { TrafficValue } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { UserDetail, UserSubscribeDetail } from "@/sections/user/user-detail";
import { useServer } from "@/stores/server";

export default function TrafficDetailsPage() {
  const { t } = useTranslation("log");
  const { getServerName } = useServer();
  return (
    <LogPage<
      API.TrafficLogDetails,
      {
        date?: string;
        server_id?: number;
        user_id?: number;
        subscribe_id?: number;
      }
    >
      columns={[
        {
          accessorKey: "server_id",
          header: t("column.server", "Server"),
          cell: ({ row }) => (
            <span>
              {getServerName(row.original.server_id)} ({row.original.server_id})
            </span>
          ),
        },
        {
          accessorKey: "user_id",
          header: t("column.user", "User"),
          cell: ({ row }) => <UserDetail id={Number(row.original.user_id)} />,
        },
        {
          accessorKey: "subscribe_id",
          header: t("column.subscribe", "Subscribe"),
          cell: ({ row }) => (
            <UserSubscribeDetail
              enabled
              hoverCard
              id={Number(row.original.subscribe_id)}
            />
          ),
        },
        {
          accessorKey: "upload",
          header: t("column.upload", "Upload"),
          cell: ({ row }) => <TrafficValue value={row.original.upload} />,
        },
        {
          accessorKey: "download",
          header: t("column.download", "Download"),
          cell: ({ row }) => <TrafficValue value={row.original.download} />,
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.trafficDetails",
        "Inspect individual traffic records across servers, users, and subscriptions."
      )}
      filterTypes={{
        date: "string",
        server_id: "number",
        user_id: "number",
        subscribe_id: "number",
      }}
      load={(pagination, filter) =>
        filterTrafficLogDetails({
          ...pagination,
          date: filter.date,
          server_id: filter.server_id,
          user_id: filter.user_id,
          subscribe_id: filter.subscribe_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "server_id", placeholder: t("column.serverId", "Server ID") },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
        {
          key: "subscribe_id",
          placeholder: t("column.subscribeId", "Subscribe ID"),
        },
      ]}
      title={t("title.trafficDetails", "Traffic Details")}
    />
  );
}
