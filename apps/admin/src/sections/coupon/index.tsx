import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  batchDeleteCoupon,
  createCoupon,
  deleteCoupon,
  getCouponList,
  updateCoupon,
} from "@workspace/ui/services/admin/coupon";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DateTimeValue,
  EnabledStatusChip,
  MoneyValue,
} from "@/components/commerce-display";
import { MobileListSummary } from "@/components/mobile-list-summary";
import { useSubscribe } from "@/stores/subscribe";
import CouponForm from "./coupon-form";

export default function Coupon() {
  const { t } = useTranslation("coupon");
  const [loading, setLoading] = useState(false);
  const { subscribes } = useSubscribe();
  const ref = useRef<ProTableActions>(null);
  return (
    <ProTable<API.Coupon, { group_id: number; query: string }>
      action={ref}
      actions={{
        render: (row) => [
          <CouponForm<API.UpdateCouponRequest>
            initialValues={row}
            key="edit"
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await updateCoupon({ ...row, ...values });
                toast.success(t("updateSuccess", "Update Success"));
                ref.current?.refresh();
                setLoading(false);
                return true;
              } catch (_error) {
                setLoading(false);
                return false;
              }
            }}
            title={t("editCoupon", "Edit Coupon")}
            trigger={t("edit", "Edit")}
          />,
          <ConfirmButton
            cancelText={t("cancel", "Cancel")}
            confirmText={t("confirm", "Confirm")}
            description={t(
              "deleteWarning",
              "Once deleted, data cannot be recovered. Please proceed with caution."
            )}
            key="delete"
            onConfirm={async () => {
              await deleteCoupon({ id: row.id });
              toast.success(t("deleteSuccess", "Delete Success"));
              ref.current?.refresh();
            }}
            title={t("confirmDelete", "Are you sure you want to delete?")}
            trigger={
              <Button variant="destructive">{t("delete", "Delete")}</Button>
            }
          />,
        ],
        batchRender: (rows) => [
          <ConfirmButton
            cancelText={t("cancel", "Cancel")}
            confirmText={t("confirm", "Confirm")}
            description={t(
              "deleteWarning",
              "Once deleted, data cannot be recovered. Please proceed with caution."
            )}
            key="delete"
            onConfirm={async () => {
              await batchDeleteCoupon({ ids: rows.map((item) => item.id) });
              toast.success(t("deleteSuccess", "Delete Success"));
              ref.current?.reset();
            }}
            title={t("confirmDelete", "Are you sure you want to delete?")}
            trigger={
              <Button variant="destructive">{t("delete", "Delete")}</Button>
            }
          />,
        ],
      }}
      columns={[
        {
          accessorKey: "enable",
          header: t("enable", "Enable"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Switch
                defaultChecked={row.getValue("enable")}
                onCheckedChange={async (checked) => {
                  await updateCoupon({
                    ...row.original,
                    enable: checked,
                  } as API.UpdateCouponRequest);
                  ref.current?.refresh();
                }}
              />
              <EnabledStatusChip
                disabledLabel={t("disabled", "Disabled")}
                enabled={Boolean(row.original.enable)}
                enabledLabel={t("enabled", "Enabled")}
              />
            </div>
          ),
        },
        {
          accessorKey: "name",
          header: t("name", "Name"),
        },
        {
          accessorKey: "code",
          header: t("code", "Code"),
        },
        {
          accessorKey: "type",
          header: t("type", "Type"),
          cell: ({ row }) => (
            <Badge
              variant={row.getValue("type") === 1 ? "default" : "secondary"}
            >
              {row.getValue("type") === 1
                ? t("percentage", "Percentage")
                : t("amount", "Amount")}
            </Badge>
          ),
        },
        {
          accessorKey: "discount",
          header: t("discount", "Discount"),
          cell: ({ row }) => (
            <Badge
              variant={row.getValue("type") === 1 ? "default" : "secondary"}
            >
              {row.getValue("type") === 1 ? (
                `${row.original.discount} %`
              ) : (
                <MoneyValue value={row.original.discount} />
              )}
            </Badge>
          ),
        },
        {
          accessorKey: "count",
          header: t("count", "Count"),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span>
                {t("count", "Count")}:{" "}
                {row.original.count === 0
                  ? t("unlimited", "Unlimited")
                  : row.original.count}
              </span>
              <span>
                {t("remainingTimes", "Remaining")}:{" "}
                {row.original.count === 0
                  ? t("unlimited", "Unlimited")
                  : row.original.count - row.original.used_count}
              </span>
              <span>
                {t("usedTimes", "Usage Times")}: {row.original.used_count}
              </span>
            </div>
          ),
        },
        {
          accessorKey: "expire",
          header: t("validityPeriod", "Validity Period"),
          cell: ({ row }) => {
            const { start_time, expire_time } = row.original;
            if (start_time) {
              return expire_time ? (
                <div className="flex flex-col gap-1">
                  <DateTimeValue value={start_time} />
                  <DateTimeValue value={expire_time} />
                </div>
              ) : (
                <DateTimeValue value={start_time} />
              );
            }
            return "--";
          },
        },
      ]}
      header={{
        title: t("couponManagement", "Coupon management"),
        toolbar: (
          <CouponForm<API.CreateCouponRequest>
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await createCoupon({
                  ...values,
                  enable: false,
                });
                toast.success(t("createSuccess", "Create Success"));
                ref.current?.refresh();
                setLoading(false);
                return true;
              } catch (_error) {
                setLoading(false);
                return false;
              }
            }}
            title={t("createCoupon", "Create Coupon")}
            trigger={t("create", "Create")}
          />
        ),
      }}
      mobile={{
        getAriaLabel: (row) => String(row.name || row.code || row.id),
        render: (row) => {
          const unlimited = row.count === 0;
          const remaining = unlimited
            ? t("unlimited", "Unlimited")
            : Math.max(row.count - row.used_count, 0);
          const validity = row.start_time ? (
            <div className="space-y-0.5">
              <DateTimeValue value={row.start_time} />
              {row.expire_time ? (
                <DateTimeValue value={row.expire_time} />
              ) : null}
            </div>
          ) : (
            "—"
          );

          return (
            <MobileListSummary
              details={[
                {
                  label: t("count", "Count"),
                  value: unlimited ? t("unlimited", "Unlimited") : row.count,
                },
                {
                  label: t("usedTimes", "Usage Times"),
                  value: row.used_count,
                },
              ]}
              fields={[
                {
                  label: t("discount", "Discount"),
                  value:
                    row.type === 1 ? (
                      <span className="font-semibold">{row.discount}%</span>
                    ) : (
                      <MoneyValue emphasis="strong" value={row.discount} />
                    ),
                },
                {
                  label: t("remainingTimes", "Remaining"),
                  value: <span className="tabular-nums">{remaining}</span>,
                },
                {
                  label: t("type", "Type"),
                  value: (
                    <Badge variant="outline">
                      {row.type === 1
                        ? t("percentage", "Percentage")
                        : t("amount", "Amount")}
                    </Badge>
                  ),
                },
                {
                  label: t("validityPeriod", "Validity Period"),
                  value: validity,
                },
              ]}
              subtitle={
                <span className="font-mono [overflow-wrap:anywhere]">
                  {row.code || "—"}
                </span>
              }
              title={row.name || "—"}
              trailing={
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t("enable", "Enable")}
                  </span>
                  <Switch
                    aria-label={t("enable", "Enable")}
                    checked={Boolean(row.enable)}
                    onCheckedChange={async (checked) => {
                      await updateCoupon({
                        ...row,
                        enable: checked,
                      } as API.UpdateCouponRequest);
                      ref.current?.refresh();
                    }}
                  />
                </div>
              }
            />
          );
        },
      }}
      params={[
        {
          key: "subscribe",
          placeholder: t("subscribe", "Subscribe"),
          options: subscribes?.map((item) => ({
            label: item.name!,
            value: String(item.id),
          })),
        },
        {
          key: "search",
        },
      ]}
      request={async (pagination, filters) => {
        const { data } = await getCouponList({
          ...pagination,
          ...filters,
        });
        return {
          list: data.data?.list || [],
          total: data.data?.total || 0,
        };
      }}
    />
  );
}
