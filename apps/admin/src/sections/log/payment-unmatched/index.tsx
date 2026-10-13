"use client";

import { getLogPaymentUnmatchedList } from "@workspace/ui/services/admin/admin";
import { useTranslation } from "react-i18next";
import { DateTimeValue } from "@/components/commerce-display";
import { MobileListSummary } from "@/components/mobile-list-summary";
import { OrderLink } from "@/components/order-link";
import {
  LogPayloadValue,
  LogTypeChip,
} from "@/sections/log/components/log-display";
import { LogPage } from "@/sections/log/components/log-page";
import { RequestSource } from "@/sections/log/request-source";
import { UserDetail } from "@/sections/user/user-detail";

type Filters = Omit<
  API.getLogPaymentUnmatchedListParams,
  "page" | "size" | "date"
>;

export function formatUnmatchedAmount(
  amount: number,
  currency: string,
  locale: string
) {
  // Like order/balance logs, API monetary amounts use hundredths. Display the
  // recorded currency, never the site's currently configured currency symbol.
  if (!Number.isFinite(amount)) return "—";
  return `${(amount / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency?.trim().toUpperCase() || "—"}`;
}

export default function UnmatchedPaymentLogPage() {
  const { t, i18n } = useTranslation("log");
  const amount = (log: API.UnmatchedPaymentLog) => (
    <span className="admin-money-value tabular-nums">
      {formatUnmatchedAmount(log.amount, log.currency, i18n.language)}
    </span>
  );
  const user = (log: API.UnmatchedPaymentLog) =>
    log.user_id > 0 ? <UserDetail id={log.user_id} /> : <span>—</span>;
  const reason = (log: API.UnmatchedPaymentLog) => (
    <LogPayloadValue
      description={t(
        "description.unmatchedPayment",
        "Review confirmed payments that could not settle an order. Refunds must be handled outside this page."
      )}
      title={t("unmatchedPayment.reasonTitle", "Unmatched payment reason")}
      value={log.reason}
      viewLabel={log.reason || t("detail", "Detail")}
    />
  );

  return (
    <LogPage<API.UnmatchedPaymentLog, Filters>
      columns={[
        {
          accessorKey: "user_id",
          header: t("column.user", "User"),
          cell: ({ row }) => user(row.original),
        },
        {
          accessorKey: "order_no",
          header: t("column.orderNo", "Order No."),
          cell: ({ row }) => <OrderLink orderId={row.original.order_no} />,
        },
        {
          accessorKey: "trade_no",
          header: t("column.tradeNo", "Trade No."),
          cell: ({ row }) => (
            <span
              className="block max-w-64 truncate font-mono text-xs"
              title={row.original.trade_no}
            >
              {row.original.trade_no || "—"}
            </span>
          ),
        },
        {
          accessorKey: "platform",
          header: t("column.platform", "Platform"),
          cell: ({ row }) => (
            <LogTypeChip>{row.original.platform || "—"}</LogTypeChip>
          ),
        },
        {
          accessorKey: "amount",
          header: t("column.amount", "Amount"),
          cell: ({ row }) => amount(row.original),
        },
        { accessorKey: "currency", header: t("column.currency", "Currency") },
        {
          accessorKey: "reason",
          header: t("column.reason", "Reason"),
          cell: ({ row }) => reason(row.original),
        },
        {
          id: "request_source",
          header: t("column.requestSource", "Request source"),
          cell: ({ row }) => <RequestSource metadata={row.original} />,
        },
        {
          accessorKey: "timestamp",
          header: t("column.time", "Time"),
          cell: ({ row }) => (
            <DateTimeValue
              value={row.original.timestamp || row.original.created_at}
            />
          ),
        },
      ]}
      description={t(
        "description.unmatchedPayment",
        "Review confirmed payments that could not settle an order. Refunds must be handled outside this page."
      )}
      filterTypes={{ search: "string", user_id: "number" }}
      load={(pagination, filters) =>
        getLogPaymentUnmatchedList({ ...pagination, ...filters })
      }
      mobile={{
        getAriaLabel: (log) =>
          `${t("title.unmatchedPayment", "Unmatched Payment Log")} #${log.id}`,
        render: (log) => (
          <MobileListSummary
            details={[
              {
                label: t("column.tradeNo", "Trade No."),
                value: log.trade_no || "—",
                wide: true,
              },
              {
                label: t("column.currency", "Currency"),
                value: log.currency || "—",
              },
              {
                label: t("column.requestSource", "Request source"),
                value: <RequestSource metadata={log} />,
                wide: true,
              },
            ]}
            fields={[
              { label: t("column.user", "User"), value: user(log), wide: true },
              {
                label: t("column.amount", "Amount"),
                value: amount(log),
                wide: true,
              },
              {
                label: t("column.reason", "Reason"),
                value: reason(log),
                wide: true,
              },
              {
                label: t("column.time", "Time"),
                value: (
                  <DateTimeValue value={log.timestamp || log.created_at} />
                ),
                wide: true,
              },
            ]}
            subtitle={log.platform || "—"}
            title={<OrderLink orderId={log.order_no} />}
          />
        ),
      }}
      params={[
        {
          key: "search",
          placeholder: t(
            "unmatchedPayment.search",
            "Search order, trade number or reason"
          ),
        },
        { key: "user_id", placeholder: t("column.userId", "User ID") },
      ]}
      title={t("title.unmatchedPayment", "Unmatched Payment Log")}
    />
  );
}
