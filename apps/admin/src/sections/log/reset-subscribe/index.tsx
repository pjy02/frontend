"use client";

import { filterResetSubscribeLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { OrderLink } from "@/components/order-link";
import { LogTypeChip } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail, UserSubscribeDetail } from "@/sections/user/user-detail";

export default function ResetSubscribeLogPage() {
  const { t } = useTranslation("log");

  const getResetSubscribeTypeText = (type: number) => {
    const typeText = t(`type.${type}`, { defaultValue: "" });
    if (!typeText) {
      return `${t("unknown", "Unknown")} (${type})`;
    }
    return typeText;
  };

  return (
    <LogPage<
      API.ResetSubscribeLog,
      { date?: string; user_subscribe_id?: number }
    >
      columns={[
        {
          accessorKey: "user",
          header: t("column.user", "User"),
          cell: ({ row }) => <UserDetail id={Number(row.original.user_id)} />,
        },
        {
          accessorKey: "user_subscribe_id",
          header: t("column.subscribeId", "Subscribe ID"),
          cell: ({ row }) => (
            <UserSubscribeDetail
              enabled
              hoverCard
              id={Number(row.original.user_subscribe_id)}
            />
          ),
        },
        {
          accessorKey: "type",
          header: t("column.type", "Type"),
          cell: ({ row }) => (
            <LogTypeChip>
              {getResetSubscribeTypeText(row.original.type)}
            </LogTypeChip>
          ),
        },
        {
          accessorKey: "order_no",
          header: t("column.orderNo", "Order No."),
          cell: ({ row }) => <OrderLink orderId={row.original.order_no} />,
        },
        {
          id: "request_source",
          header: t("column.requestSource", "Request source"),
          cell: ({ row }) => <RequestSource metadata={row.original} />,
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.resetSubscribe",
        "Review subscription resets, their source orders, and affected accounts."
      )}
      filterTypes={{ date: "string", user_subscribe_id: "number" }}
      load={(pagination, filter) =>
        filterResetSubscribeLog({
          ...pagination,
          date: filter.date,
          user_subscribe_id: filter.user_subscribe_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        {
          key: "user_subscribe_id",
          placeholder: t("column.subscribeId", "Subscribe ID"),
        },
      ]}
      title={t("title.resetSubscribe", "Reset Subscribe Log")}
    />
  );
}
