import { useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import { Separator } from "@workspace/ui/components/separator";
import { Combobox } from "@workspace/ui/composed/combobox";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  getOrderList,
  putOrderStatus as updateOrderStatus,
} from "@workspace/ui/services/admin/admin";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DateTimeValue,
  MoneyValue,
  OrderStatusChip,
} from "@/components/commerce-display";
import { MobileListSummary } from "@/components/mobile-list-summary";
import { useSubscribe } from "@/stores/subscribe";
import {
  getTablePagination,
  useTablePaginationSearchParams,
  useTableSearchParams,
} from "@/utils/use-table-search-params";
import { UserDetail } from "../user/user-detail";

export default function Order() {
  const { t } = useTranslation("order");
  const sp = useSearch({ strict: false }) as Record<string, string | undefined>;

  const statusOptions = [
    { value: 1, label: t("status.1", "Pending") },
    { value: 2, label: t("status.2", "Paid") },
    { value: 3, label: t("status.3", "Cancelled") },
    { value: 4, label: t("status.4", "Closed") },
    { value: 5, label: t("status.5", "Completed") },
  ];

  const typeOptions = [
    { value: 1, label: t("type.1", "New Purchase") },
    { value: 2, label: t("type.2", "Renewal") },
    { value: 3, label: t("type.3", "Reset Traffic") },
    { value: 4, label: t("type.4", "Recharge") },
  ];

  const ref = useRef<ProTableActions>(null);

  const { subscribes, getSubscribeName } = useSubscribe();
  const syncFilters = useTableSearchParams([
    "status",
    "subscribe_id",
    "search",
    "user_id",
  ]);
  const syncPagination = useTablePaginationSearchParams();
  const initialPagination = getTablePagination(sp);

  const initialFilters = {
    status: sp.status || undefined,
    subscribe_id: sp.subscribe_id || undefined,
    search: sp.search || undefined,
    user_id: sp.user_id ? Number(sp.user_id) : undefined,
  };

  return (
    <ProTable<API.Order, any>
      action={ref}
      columns={[
        {
          accessorKey: "order_no",
          header: t("orderNumber", "Order Number"),
        },
        {
          accessorKey: "type",
          header: t("type.0", "Type"),
          cell: ({ row }) => {
            const type = row.getValue("type") as number;
            return (
              typeOptions.find((opt) => opt.value === type)?.label ||
              t(`type.${type}`)
            );
          },
        },
        {
          accessorKey: "subscribe_id",
          header: t("subscribe", "Subscribe"),
          cell: ({ row }) => {
            const order = row.original as API.Order;
            if (order.type === 4) {
              const type = row.getValue("type") as number;
              return (
                typeOptions.find((opt) => opt.value === type)?.label ||
                t(`type.${type}`)
              );
            }
            const name = getSubscribeName(order.subscribe_id);
            const quantity = order.quantity;
            return name ? `${name} × ${quantity}` : "";
          },
        },
        {
          accessorKey: "amount",
          header: t("amount", "Amount"),
          cell: ({ row }) => {
            const order = row.original as API.Order;
            return (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button className="p-0" variant="link">
                    <MoneyValue emphasis="strong" value={order.amount} />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-auto max-w-[80vw]">
                  <div className="grid gap-3">
                    {order.trade_no && (
                      <>
                        <div className="font-semibold">
                          {t("tradeNo", "Transaction Number")}
                        </div>
                        <span className="break-all text-muted-foreground">
                          {order.trade_no}
                        </span>
                        <Separator className="my-2" />
                      </>
                    )}
                    <ul className="admin-commerce-summary">
                      <li className="admin-commerce-summary__row">
                        <span className="text-muted-foreground">
                          {t("subscribePrice", "Subscription Price")}
                        </span>
                        <span>
                          <MoneyValue value={order.price} />
                        </span>
                      </li>
                      <li className="admin-commerce-summary__row">
                        <span className="text-muted-foreground">
                          {t("discount", "Discount Amount")}
                        </span>
                        <span>
                          <MoneyValue value={order.discount} />
                        </span>
                      </li>
                      <li className="admin-commerce-summary__row">
                        <span className="text-muted-foreground">
                          {t("couponDiscount", "Coupon Discount")}
                        </span>
                        <span>
                          <MoneyValue value={order.coupon_discount} />
                        </span>
                      </li>
                      <li className="admin-commerce-summary__row">
                        <span className="text-muted-foreground">
                          {t("feeAmount", "Fee Amount")}
                        </span>
                        <span>
                          <MoneyValue value={order.fee_amount} />
                        </span>
                      </li>
                      <li className="admin-commerce-summary__row border-t pt-3 font-semibold">
                        <span className="text-muted-foreground">
                          {t("total", "Total")}
                        </span>
                        <span>
                          <MoneyValue emphasis="strong" value={order.amount} />
                        </span>
                      </li>
                    </ul>
                  </div>
                  <Separator className="my-4" />
                  <ul className="admin-commerce-summary">
                    <li className="admin-commerce-summary__row">
                      <span className="text-muted-foreground">
                        {t("method", "Payment Method")}
                      </span>
                      <span>
                        {order.payment?.name || order.payment?.platform}
                      </span>
                    </li>
                  </ul>
                </HoverCardContent>
              </HoverCard>
            );
          },
        },
        {
          accessorKey: "user_id",
          header: t("user", "User"),
          cell: ({ row }) => {
            const order = row.original as API.Order;
            return <UserDetail id={order.user_id} />;
          },
        },
        {
          accessorKey: "updated_at",
          header: t("updateTime", "Update Time"),
          cell: ({ row }) => {
            const order = row.original as API.Order;
            return <DateTimeValue value={order.updated_at} />;
          },
        },
        {
          accessorKey: "status",
          header: t("status.0", "Status"),
          cell: ({ row }) => {
            const order = row.original as API.Order;
            const option = statusOptions.find(
              (opt) => opt.value === order.status
            );
            if ([1, 3, 4].includes(row.getValue("status"))) {
              return (
                <Combobox<number, false>
                  onChange={async (value) => {
                    await updateOrderStatus({
                      id: order.id,
                      status: value,
                    });
                    ref.current?.refresh();
                  }}
                  options={statusOptions.map((item) => ({
                    ...item,
                    children: (
                      <OrderStatusChip label={item.label} status={item.value} />
                    ),
                  }))}
                  placeholder={t("status.0", "Status")}
                  value={order.status}
                />
              );
            }
            return (
              <OrderStatusChip
                label={option?.label || t(`status.${row.getValue("status")}`)}
                status={order.status}
              />
            );
          },
        },
      ]}
      header={{
        title: t("orderManagement", "Order management"),
      }}
      initialFilters={initialFilters}
      initialPagination={initialPagination}
      mobile={{
        getAriaLabel: (row) => String(row.order_no || row.id),
        render: (row) => {
          const statusOption = statusOptions.find(
            (option) => option.value === row.status
          );
          const typeLabel =
            typeOptions.find((option) => option.value === row.type)?.label ||
            t(`type.${row.type}`);
          const subscribeLabel =
            row.type === 4
              ? typeLabel
              : `${getSubscribeName(row.subscribe_id) || "—"} × ${row.quantity}`;
          const status = [1, 3, 4].includes(row.status) ? (
            <Combobox<number, false>
              onChange={async (value) => {
                await updateOrderStatus({ id: row.id, status: value });
                ref.current?.refresh();
              }}
              options={statusOptions.map((item) => ({
                ...item,
                children: (
                  <OrderStatusChip label={item.label} status={item.value} />
                ),
              }))}
              placeholder={t("status.0", "Status")}
              value={row.status}
            />
          ) : (
            <OrderStatusChip
              label={statusOption?.label || t(`status.${row.status}`)}
              status={row.status}
            />
          );

          return (
            <MobileListSummary
              fields={[
                {
                  label: t("amount", "Amount"),
                  value: <MoneyValue emphasis="strong" value={row.amount} />,
                },
                {
                  label: t("subscribe", "Subscribe"),
                  value: subscribeLabel,
                },
                {
                  label: t("user", "User"),
                  value: <UserDetail id={row.user_id} />,
                },
                {
                  label: t("updateTime", "Update Time"),
                  value: <DateTimeValue value={row.updated_at} />,
                },
              ]}
              subtitle={typeLabel}
              title={row.order_no || `#${row.id}`}
              trailing={status}
            />
          );
        },
      }}
      onFiltersChange={syncFilters}
      onPaginationChange={syncPagination}
      params={[
        {
          key: "status",
          placeholder: t("status.0", "Status"),
          options: statusOptions.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
        },
        {
          key: "subscribe_id",
          placeholder: `${t("subscribe", "Subscribe")}`,
          options: subscribes?.map((item) => ({
            label: item.name!,
            value: String(item.id),
          })),
        },
        { key: "search" },
        {
          key: "user_id",
          placeholder: `${t("user", "User")} ID`,
          options: undefined,
        },
      ]}
      request={async (pagination, filter) => {
        const { data } = await getOrderList({ ...pagination, ...filter });
        return {
          list: data.data?.list || [],
          total: data.data?.total || 0,
        };
      }}
    />
  );
}
