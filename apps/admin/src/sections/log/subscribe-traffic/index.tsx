"use client";

import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { filterUserSubscribeTrafficLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { TrafficValue } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { UserDetail, UserSubscribeDetail } from "@/sections/user/user-detail";

export default function SubscribeTrafficLogPage() {
  const { t } = useTranslation("log");
  return (
    <LogPage<
      API.UserSubscribeTrafficLog,
      { date?: string; user_id?: number; user_subscribe_id?: number }
    >
      actions={{
        render: (row) => [
          <Button asChild key="detail">
            <Link
              search={{
                date: row.date,
                user_id: row.user_id,
                subscribe_id: row.subscribe_id,
              }}
              to="/dashboard/log/traffic-details"
            >
              {t("detail", "Detail")}
            </Link>
          </Button>,
        ],
      }}
      columns={[
        {
          accessorKey: "user",
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
          accessorKey: "total",
          header: t("column.total", "Total"),
          cell: ({ row }) => <TrafficValue value={row.original.total} />,
        },
        {
          accessorKey: "date",
          header: t("column.date", "Date"),
        },
      ]}
      description={t(
        "description.subscribeTraffic",
        "Compare daily traffic consumption by user and subscription."
      )}
      filterTypes={{
        date: "string",
        user_id: "number",
        user_subscribe_id: "number",
      }}
      load={(pagination, filter) =>
        filterUserSubscribeTrafficLog({
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
      title={t("title.subscribeTraffic", "Subscribe Traffic Log")}
    />
  );
}
