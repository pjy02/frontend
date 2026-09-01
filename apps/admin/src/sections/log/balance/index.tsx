"use client";

import { filterBalanceLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue, MoneyValue } from "@/components/commerce-display";
import { OrderLink } from "@/components/order-link";
import { LogTypeChip } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail } from "@/sections/user/user-detail";

export default function BalanceLogPage() {
  const { t } = useTranslation("log");

  // i18n type declarations for extraction
  // t("type.231", "Auto Reset")
  // t("type.232", "Advance Reset")
  // t("type.233", "Paid Reset")
  // t("type.321", "Recharge")
  // t("type.322", "Withdraw")
  // t("type.323", "Payment")
  // t("type.324", "Refund")
  // t("type.325", "Reward")
  // t("type.326", "Admin Adjust")
  // t("type.331", "Purchase")
  // t("type.332", "Renewal")
  // t("type.333", "Refund")
  // t("type.334", "Withdraw")
  // t("type.335", "Admin Adjust")
  // t("type.341", "Increase")
  // t("type.342", "Reduce")

  const getBalanceTypeText = (type: number) => {
    const typeText = t(`type.${type}`, { defaultValue: "" });
    if (!typeText) {
      return `${t("unknown", "Unknown")} (${type})`;
    }
    return typeText;
  };

  return (
    <LogPage<API.BalanceLog, { date?: string; user_id?: number }>
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
          accessorKey: "balance",
          header: t("column.balance", "Balance"),
          cell: ({ row }) => <MoneyValue value={row.original.balance} />,
        },
        {
          accessorKey: "type",
          header: t("column.type", "Type"),
          cell: ({ row }) => (
            <LogTypeChip>{getBalanceTypeText(row.original.type)}</LogTypeChip>
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
        "description.balance",
        "Review account balance changes, related orders, and adjustment reasons."
      )}
      filterTypes={{ date: "string", user_id: "number" }}
      load={(pagination, filter) =>
        filterBalanceLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.balance", "Balance Log")}
    />
  );
}
