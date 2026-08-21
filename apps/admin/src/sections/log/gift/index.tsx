"use client";

import { filterGiftLog } from "@workspace/ui/services/admin/log";
import { useTranslation } from "react-i18next";
import { DateTimeValue, MoneyValue } from "@/components/commerce-display";
import { OrderLink } from "@/components/order-link";
import { LogTypeChip } from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { UserDetail, UserSubscribeDetail } from "@/sections/user/user-detail";

export default function GiftLogPage() {
  const { t } = useTranslation("log");

  const getGiftTypeText = (type: number) => {
    const typeText = t(`type.${type}`, { defaultValue: "" });
    if (!typeText) {
      return `${t("unknown", "Unknown")} (${type})`;
    }
    return typeText;
  };

  return (
    <LogPage<API.GiftLog, { date?: string; user_id?: number }>
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
          accessorKey: "order_no",
          header: t("column.orderNo", "Order No."),
          cell: ({ row }) => <OrderLink orderId={row.original.order_no} />,
        },
        {
          accessorKey: "amount",
          header: t("column.amount", "Amount"),
          cell: ({ row }) => (
            <MoneyValue emphasis="strong" value={row.original.amount} />
          ),
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
            <LogTypeChip>{getGiftTypeText(row.original.type)}</LogTypeChip>
          ),
        },
        { accessorKey: "remark", header: t("column.remark", "Remark") },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => <DateTimeValue value={row.original.timestamp} />,
        },
      ]}
      description={t(
        "description.gift",
        "Inspect gifts, affected subscriptions, balances, and related orders."
      )}
      filterTypes={{ date: "string", user_id: "number" }}
      load={(pagination, filter) =>
        filterGiftLog({
          ...pagination,
          date: filter.date,
          user_id: filter.user_id,
        })
      }
      params={[
        { key: "date", type: "date" },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.gift", "Gift Log")}
    />
  );
}
