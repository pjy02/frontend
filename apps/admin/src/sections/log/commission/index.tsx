"use client";

import { getLogCommissionList as filterCommissionLog } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { DateTimeValue, MoneyValue } from "@/components/commerce-display";
import { OrderLink } from "@/components/order-link";
import { LogTypeChip } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail } from "@/sections/user/user-detail";

export default function CommissionLogPage() {
  const { t } = useTranslation("log");

  const getCommissionTypeText = (type: number) => {
    const typeText = t(`type.${type}`, { defaultValue: "" });
    if (!typeText) {
      return `${t("unknown", "Unknown")} (${type})`;
    }
    return typeText;
  };

  return (
    <LogPage<API.CommissionLog, { date?: string; user_id?: number }>
      columns={[
        {
          accessorKey: "user",
          header: t("column.user", "User"),
          cell: ({ row }) => <UserDetail id={Number(row.original.user_id)} />,
        },
        {
          accessorKey: "amount",
          header: t("column.amount", "Amount"),
          cell: ({ row }) => (
            <MoneyValue emphasis="strong" value={row.original.amount} />
          ),
        },
        {
          accessorKey: "order_no",
          header: t("column.orderNo", "Order No."),
          cell: ({ row }) => <OrderLink orderId={row.original.order_no} />,
        },
        {
          accessorKey: "type",
          header: t("column.type", "Type"),
          cell: ({ row }) => (
            <LogTypeChip>
              {getCommissionTypeText(row.original.type)}
            </LogTypeChip>
          ),
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
        "description.commission",
        "Trace commission credits and the orders that generated them."
      )}
      filterTypes={{ date: "string", user_id: "number" }}
      load={(pagination, filter) =>
        filterCommissionLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.commission", "Commission Log")}
    />
  );
}
