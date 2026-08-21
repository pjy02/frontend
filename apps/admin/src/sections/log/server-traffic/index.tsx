"use client";

import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { filterServerTrafficLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import {
  LogTypeChip,
  TrafficValue,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { useServer } from "@/stores/server";

export default function ServerTrafficLogPage() {
  const { t } = useTranslation("log");
  const { getServerName } = useServer();
  return (
    <LogPage<API.ServerTrafficLog, { date?: string; server_id?: number }>
      actions={{
        render: (row) => [
          <Button asChild key="detail">
            <Link
              search={{ date: row.date, server_id: row.server_id }}
              to="/dashboard/log/traffic-details"
            >
              {t("detail", "Detail")}
            </Link>
          </Button>,
        ],
      }}
      columns={[
        {
          accessorKey: "server_id",
          header: t("column.server", "Server"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <LogTypeChip>{row.original.server_id}</LogTypeChip>
              <span>{getServerName(row.original.server_id)}</span>
            </div>
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
        { accessorKey: "date", header: t("column.date", "Date") },
      ]}
      description={t(
        "description.serverTraffic",
        "Compare daily upload and download totals across servers."
      )}
      filterTypes={{ date: "string", server_id: "number" }}
      load={(pagination, filter) =>
        filterServerTrafficLog({
          ...pagination,
          date: filter.date,
          server_id: filter.server_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "server_id", placeholder: t("column.serverId", "Server ID") },
      ]}
      title={t("title.serverTraffic", "Server Traffic Log")}
    />
  );
}
