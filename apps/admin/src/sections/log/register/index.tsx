"use client";

import { filterRegisterLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { IpLink } from "@/components/ip-link";
import {
  LogTypeChip,
  UserAgentValue,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail } from "@/sections/user/user-detail";

export default function RegisterLogPage() {
  const { t } = useTranslation("log");
  return (
    <LogPage<API.RegisterLog, { date?: string; user_id?: number }>
      columns={[
        {
          accessorKey: "user",
          header: t("column.user", "User"),
          cell: ({ row }) => <UserDetail id={Number(row.original.user_id)} />,
        },
        {
          accessorKey: "auth_method",
          header: t("column.identifier", "Identifier"),
          cell: ({ row }) => (
            <div className="flex items-center">
              <LogTypeChip>{row.original.auth_method}</LogTypeChip>
              <span className="ml-1 text-sm">{row.original.identifier}</span>
            </div>
          ),
        },
        {
          accessorKey: "register_ip",
          header: t("column.ip", "IP"),
          cell: ({ row }) => (
            <IpLink
              ip={String(
                (row.original as API.RegisterLog & { register_ip?: string })
                  .register_ip || ""
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
          id: "request_source",
          header: t("column.requestSource", "Request source"),
          cell: ({ row }) => (
            <RequestSource
              ip={row.original.register_ip}
              metadata={row.original}
            />
          ),
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.register",
        "Review account registrations, identifiers, source addresses, and clients."
      )}
      filterTypes={{ date: "string", user_id: "number" }}
      load={(pagination, filter) =>
        filterRegisterLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.register", "Register Log")}
    />
  );
}
