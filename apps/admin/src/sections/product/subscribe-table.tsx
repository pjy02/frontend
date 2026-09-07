"use client";

import { Link, useSearch } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  deleteSubscribeBatch as batchDeleteSubscribe,
  postSubscribe as createSubscribe,
  deleteSubscribe,
  getSubscribeList,
  postSubscribeSort as subscribeSort,
  putSubscribe as updateSubscribe,
} from "@workspace/ui/services/admin/admin";
import { Copy, MoreVertical, Trash2 } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AdminActionMenu,
  AdminActionMenuDangerItem,
  AdminActionMenuItem,
} from "@/components/admin-action-menu";
import { EnabledStatusChip, MoneyValue } from "@/components/commerce-display";
import { Display } from "@/components/display";
import { MobileListSummary } from "@/components/mobile-list-summary";
import { useSubscribe } from "@/stores/subscribe";
import SubscribeForm from "./subscribe-form";

export default function SubscribeTable({
  actionRef,
}: {
  actionRef?: RefObject<ProTableActions | null>;
}) {
  const { t } = useTranslation("product");
  const routeSearch = useSearch({ strict: false });
  const [loading, setLoading] = useState(false);
  const internalActionRef = useRef<ProTableActions>(null);
  const ref = actionRef ?? internalActionRef;
  const { fetchSubscribes } = useSubscribe();
  return (
    <ProTable<API.SubscribeItem, { group_id: number; query: string }>
      action={ref}
      actions={{
        visibleCount: 2,
        render: (row) => [
          <Button asChild key="edit">
            <Link
              params={{ productId: String(row.id) }}
              resetScroll={false}
              search={routeSearch}
              to="/dashboard/product/$productId"
            >
              {t("edit")}
            </Link>
          </Button>,
          <ProductRowActions
            key="more"
            onChanged={() => {
              ref.current?.refresh();
              fetchSubscribes();
            }}
            product={row}
          />,
        ],
        batchRender: (rows) => [
          <ConfirmButton
            cancelText={t("cancel")}
            confirmText={t("confirm")}
            description={t("deleteWarning")}
            key="delete"
            onConfirm={async () => {
              await batchDeleteSubscribe({
                ids: rows.map((item) => item.id) as number[],
              });

              toast.success(t("deleteSuccess"));
              ref.current?.reset();
              fetchSubscribes();
            }}
            title={t("confirmDelete")}
            trigger={<Button variant="destructive">{t("delete")}</Button>}
          />,
        ],
      }}
      columns={[
        {
          accessorKey: "show",
          header: t("show"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Switch
                defaultChecked={row.getValue("show")}
                onCheckedChange={async (checked) => {
                  await updateSubscribe({
                    ...row.original,
                    show: checked,
                  } as API.UpdateSubscribeRequest);
                  ref.current?.refresh();
                  fetchSubscribes();
                }}
              />
              <EnabledStatusChip
                disabledLabel={t("hidden", "Hidden")}
                enabled={Boolean(row.original.show)}
                enabledLabel={t("visible", "Visible")}
              />
            </div>
          ),
        },
        {
          accessorKey: "sell",
          header: t("sell"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Switch
                defaultChecked={row.getValue("sell")}
                onCheckedChange={async (checked) => {
                  await updateSubscribe({
                    ...row.original,
                    sell: checked,
                  } as API.UpdateSubscribeRequest);
                  ref.current?.refresh();
                  fetchSubscribes();
                }}
              />
              <EnabledStatusChip
                disabledLabel={t("notForSale", "Not for sale")}
                enabled={Boolean(row.original.sell)}
                enabledLabel={t("onSale", "On sale")}
              />
            </div>
          ),
        },
        {
          accessorKey: "name",
          header: t("name"),
        },
        {
          accessorKey: "unit_price",
          header: t("unitPrice"),
          cell: ({ row }) => (
            <>
              <MoneyValue value={row.getValue("unit_price")} />/
              {t(
                row.original.unit_time
                  ? `form.${row.original.unit_time}`
                  : "form.Month"
              )}
            </>
          ),
        },
        {
          accessorKey: "replacement",
          header: t("replacement"),
          cell: ({ row }) => <MoneyValue value={row.getValue("replacement")} />,
        },
        {
          accessorKey: "traffic",
          header: t("traffic"),
          cell: ({ row }) => (
            <Display type="traffic" unlimited value={row.getValue("traffic")} />
          ),
        },
        {
          accessorKey: "device_limit",
          header: t("deviceLimit"),
          cell: ({ row }) => (
            <Display
              type="number"
              unlimited
              value={row.getValue("device_limit")}
            />
          ),
        },
        {
          accessorKey: "inventory",
          header: t("inventory"),
          cell: ({ row }) => {
            const inventory = row.getValue("inventory") as number;
            return inventory === -1 ? (
              <Display type="number" unlimited value={0} />
            ) : (
              <Display type="number" unlimited value={inventory} />
            );
          },
        },
        {
          accessorKey: "quota",
          header: t("quota"),
          cell: ({ row }) => (
            <Display type="number" unlimited value={row.getValue("quota")} />
          ),
        },
        {
          accessorKey: "language",
          header: t("language"),
          cell: ({ row }) => {
            const language = row.getValue("language") as string;
            return language ? (
              <Badge variant="outline">{language}</Badge>
            ) : (
              "--"
            );
          },
        },
        {
          accessorKey: "sold",
          header: t("sold"),
          cell: ({ row }) => (
            <Badge variant="outline">{row.getValue("sold")}</Badge>
          ),
        },
      ]}
      header={{
        title: t("productManagement", "Product management"),
        toolbar: (
          <SubscribeForm<API.CreateSubscribeRequest>
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await createSubscribe({
                  ...values,
                  show: false,
                  sell: false,
                });
                toast.success(t("createSuccess"));
                ref.current?.refresh();
                fetchSubscribes();
                setLoading(false);

                return true;
              } catch {
                setLoading(false);

                return false;
              }
            }}
            title={t("createSubscribe")}
            trigger={t("create")}
          />
        ),
      }}
      mobile={{
        getAriaLabel: (row) => String(row.name || row.id),
        render: (row) => (
          <MobileListSummary
            details={[
              {
                label: t("replacement"),
                value: <MoneyValue value={row.replacement} />,
              },
              {
                label: t("deviceLimit"),
                value: (
                  <Display type="number" unlimited value={row.device_limit} />
                ),
              },
              {
                label: t("quota"),
                value: <Display type="number" unlimited value={row.quota} />,
              },
              {
                label: t("language"),
                value: row.language ? (
                  <Badge variant="outline">{row.language}</Badge>
                ) : (
                  "—"
                ),
              },
            ]}
            fields={[
              {
                label: t("unitPrice"),
                value: (
                  <>
                    <MoneyValue emphasis="strong" value={row.unit_price} />/
                    {t(row.unit_time ? `form.${row.unit_time}` : "form.Month")}
                  </>
                ),
              },
              {
                label: t("traffic"),
                value: <Display type="traffic" unlimited value={row.traffic} />,
              },
              {
                label: t("inventory"),
                value: (
                  <Display
                    type="number"
                    unlimited
                    value={row.inventory === -1 ? 0 : row.inventory}
                  />
                ),
              },
              {
                label: t("sold"),
                value: <span className="tabular-nums">{row.sold ?? 0}</span>,
              },
            ]}
            subtitle={`ID ${row.id ?? "—"}`}
            title={row.name || "—"}
            trailing={
              <div className="grid gap-2 text-xs">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-muted-foreground">{t("show")}</span>
                  <Switch
                    aria-label={t("show")}
                    checked={Boolean(row.show)}
                    onCheckedChange={async (checked) => {
                      await updateSubscribe({
                        ...row,
                        show: checked,
                      } as API.UpdateSubscribeRequest);
                      ref.current?.refresh();
                      fetchSubscribes();
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-muted-foreground">{t("sell")}</span>
                  <Switch
                    aria-label={t("sell")}
                    checked={Boolean(row.sell)}
                    onCheckedChange={async (checked) => {
                      await updateSubscribe({
                        ...row,
                        sell: checked,
                      } as API.UpdateSubscribeRequest);
                      ref.current?.refresh();
                      fetchSubscribes();
                    }}
                  />
                </div>
              </div>
            }
          />
        ),
      }}
      onSort={async (source, target, items) => {
        const sourceIndex = items.findIndex(
          (item) => String(item.id) === source
        );
        const targetIndex = items.findIndex(
          (item) => String(item.id) === target
        );

        const originalSorts = items.map((item) => item.sort);

        const [movedItem] = items.splice(sourceIndex, 1);
        items.splice(targetIndex, 0, movedItem!);

        const updatedItems = items.map((item, index) => {
          const originalSort = originalSorts[index];
          const newSort = originalSort !== undefined ? originalSort : item.sort;
          return { ...item, sort: newSort };
        });

        const changedItems = updatedItems.filter(
          (item, index) => item.sort !== items[index]?.sort
        );

        if (changedItems.length > 0) {
          await subscribeSort({
            sort: changedItems.map((item) => ({
              id: item.id,
              sort: item.sort,
            })) as API.SortItem[],
          });
          toast.success(t("sortSuccess", "Sort completed successfully"));
        }

        return updatedItems;
      }}
      params={[
        {
          key: "search",
        },
      ]}
      request={async (pagination, filters) => {
        const { data } = await getSubscribeList({
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

function ProductRowActions({
  onChanged,
  product,
}: {
  onChanged: () => void;
  product: API.SubscribeItem;
}) {
  const { t } = useTranslation("product");
  const deleteRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const [copying, setCopying] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdminActionMenu
        description={t(
          "actionsDescription",
          "Copy this product as a disabled draft or delete it."
        )}
        onOpenChange={setOpen}
        open={open}
        title={t("moreActions", "More actions")}
        trigger={
          <Button
            aria-label={t("moreActions", "More actions")}
            className="size-8 rounded-full"
            ref={moreTriggerRef}
            size="icon"
            title={t("moreActions", "More actions")}
            variant="ghost"
          >
            <MoreVertical />
          </Button>
        }
      >
        <AdminActionMenuItem
          closeOnSelect={false}
          icon={<Copy />}
          loading={copying}
          loadingLabel={t("copying", "Copying product")}
          onAction={async () => {
            setCopying(true);
            try {
              const {
                id: _id,
                sort: _sort,
                sell: _sell,
                updated_at: _updatedAt,
                created_at: _createdAt,
                ...params
              } = product;
              await createSubscribe({
                ...params,
                show: false,
                sell: false,
              } as API.CreateSubscribeRequest);
              toast.success(t("copySuccess", "Copied successfully"));
              setOpen(false);
              onChanged();
            } catch {
              toast.error(t("copyFailed", "Unable to copy product"));
            } finally {
              setCopying(false);
            }
          }}
        >
          {t("copy", "Copy")}
        </AdminActionMenuItem>
        <AdminActionMenuDangerItem
          icon={<Trash2 />}
          onAction={() => deleteRef.current?.click()}
        >
          {t("delete", "Delete")}
        </AdminActionMenuDangerItem>
      </AdminActionMenu>
      <ConfirmButton
        cancelText={t("cancel")}
        confirmText={t("confirm")}
        description={t("deleteWarning")}
        onConfirm={async () => {
          await deleteSubscribe({ id: product.id! });
          toast.success(t("deleteSuccess"));
          onChanged();
        }}
        restoreFocusRef={moreTriggerRef}
        title={t("confirmDelete")}
        trigger={<Button className="hidden" ref={deleteRef} />}
      />
    </>
  );
}
