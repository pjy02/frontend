"use client";

import { filterLoginLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { IpLink } from "@/components/ip-link";
import {
  LogStatusChip,
  LogTypeChip,
  UserAgentValue,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { UserDetail } from "@/sections/user/user-detail";

export default function LoginLogPage() {
  const { t } = useTranslation("log");
  return (
    <LogPage<API.LoginLog, { date?: string; user_id?: number }>
      columns={[
        {
          accessorKey: "user",
          header: t("column.user", "User"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <LogTypeChip>{row.original.method}</LogTypeChip>
              <UserDetail id={Number(row.original.user_id)} />
            </div>
          ),
        },

        {
          accessorKey: "login_ip",
          header: t("column.ip", "IP"),
          cell: ({ row }) => (
            <IpLink
              ip={String(
                (row.original as API.LoginLog & { login_ip?: string })
                  .login_ip || ""
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
          accessorKey: "success",
          header: t("column.success", "Success"),
          cell: ({ row }) =>
            row.original.success ? (
              <LogStatusChip status="success">
                {t("success", "Success")}
              </LogStatusChip>
            ) : (
              <LogStatusChip status="error">
                {t("failed", "Failed")}
              </LogStatusChip>
            ),
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.login",
        "Audit sign-in attempts, authentication methods, clients, and outcomes."
      )}
      filterTypes={{ date: "string", user_id: "number" }}
      load={(pagination, filter) =>
        filterLoginLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.login", "Login Log")}
    />
  );
}
