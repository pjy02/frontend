"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  postServerNodeCreate as createNode,
  postServerNodeOpenApiDelete as deleteNode,
  getServerNodeList as filterNodeList,
  postServerNodeSort as resetSortWithNode,
  postServerNodeStatusToggle as toggleNodeStatus,
  postServerNodeUpdate as updateNode,
} from "@workspace/ui/services/admin/admin";
import { Copy, MoreVertical, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AdminActionMenu,
  AdminActionMenuDangerItem,
  AdminActionMenuItem,
} from "@/components/admin-action-menu";
import { StatusChip } from "@/components/status-chip";
import { useNode } from "@/stores/node";
import { useServer } from "@/stores/server";
import NodeForm from "./node-form";

const NODE_SORT_BATCH_SIZE = 100;

function sortNodes(nodes: API.Node[]) {
  return nodes.slice().sort((a, b) => {
    const as = a.sort;
    const bs = b.sort;
    const an = typeof as === "number" ? as : Number.POSITIVE_INFINITY;
    const bn = typeof bs === "number" ? bs : Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    return Number(a.id) - Number(b.id);
  });
}

async function filterAllNodes(search?: string) {
  const firstResponse = await filterNodeList({
    page: 1,
    size: NODE_SORT_BATCH_SIZE,
    search: search || undefined,
  });
  const firstPage = (firstResponse.data?.data?.list || []) as API.Node[];
  const total = Number(firstResponse.data?.data?.total || firstPage.length);

  if (total <= firstPage.length) {
    return sortNodes(firstPage);
  }

  // Older backends may enforce a lower cap than the documented 100 records.
  // Derive the effective size so the sortable workspace still loads every page.
  const effectivePageSize = firstPage.length || NODE_SORT_BATCH_SIZE;
  const pageCount = Math.ceil(total / effectivePageSize);
  const remainingResponses = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) =>
      filterNodeList({
        page: index + 2,
        size: NODE_SORT_BATCH_SIZE,
        search: search || undefined,
      })
    )
  );
  const merged = [
    ...firstPage,
    ...remainingResponses.flatMap(
      (response) => (response.data?.data?.list || []) as API.Node[]
    ),
  ];
  const uniqueNodes = Array.from(
    new Map(merged.map((node) => [String(node.id), node])).values()
  );

  return sortNodes(uniqueNodes);
}

export default function Nodes() {
  const { t } = useTranslation("nodes");
  const ref = useRef<ProTableActions>(null);
  const [loading, setLoading] = useState(false);

  // Use our zustand store for server data
  const { getServerName, getServerAddress, getProtocolPort } = useServer();
  const { fetchNodes, fetchTags } = useNode();

  return (
    <ProTable<API.Node, { search: string }>
      action={ref}
      actions={{
        visibleCount: 2,
        render: (row) => [
          <NodeForm
            initialValues={row}
            key="edit"
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                const body: API.UpdateNodeRequest = {
                  ...row,
                  ...values,
                } as any;
                await updateNode(body);
                toast.success(t("updated", "Updated"));
                ref.current?.refresh();
                fetchNodes();
                fetchTags();
                setLoading(false);
                return true;
              } catch {
                setLoading(false);
                return false;
              }
            }}
            title={t("drawerEditTitle", "Edit Node")}
            trigger={t("edit", "Edit")}
          />,
          <NodeRowActions
            key="more"
            node={row}
            onChanged={() => {
              ref.current?.refresh();
              fetchNodes();
              fetchTags();
            }}
          />,
        ],
        batchRender(rows) {
          return [
            <ConfirmButton
              cancelText={t("cancel", "Cancel")}
              confirmText={t("confirm", "Confirm")}
              description={t(
                "confirmDeleteDesc",
                "This action cannot be undone."
              )}
              key="delete"
              onConfirm={async () => {
                await Promise.all(
                  rows.map((r) => deleteNode({ id: r.id } as any))
                );
                toast.success(t("deleted", "Deleted"));
                ref.current?.refresh();
                fetchNodes();
                fetchTags();
              }}
              title={t("confirmDeleteTitle", "Delete this node?")}
              trigger={
                <Button variant="destructive">{t("delete", "Delete")}</Button>
              }
            />,
          ];
        },
      }}
      columns={[
        {
          id: "enabled",
          header: t("enabled", "Enabled"),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Switch
                checked={row.original.enabled}
                onCheckedChange={async (v) => {
                  await toggleNodeStatus({ id: row.original.id, enable: v });
                  toast.success(
                    v
                      ? t("enabled_on", "Enabled")
                      : t("enabled_off", "Disabled")
                  );
                  ref.current?.refresh();
                  fetchNodes();
                  fetchTags();
                }}
              />
              <StatusChip
                dot={false}
                tone={row.original.enabled ? "success" : "neutral"}
              >
                {row.original.enabled
                  ? t("enabled_on", "Enabled")
                  : t("enabled_off", "Disabled")}
              </StatusChip>
            </div>
          ),
        },
        { accessorKey: "name", header: t("name", "Name") },

        {
          id: "address_port",
          header: `${t("address", "Address")}:${t("port", "Port")}`,
          cell: ({ row }) =>
            `${row.original.address || "—"}:${row.original.port || "—"}`,
        },

        {
          id: "server_id",
          header: t("server", "Server"),
          cell: ({ row }) =>
            `${getServerName(row.original.server_id)}:${getServerAddress(row.original.server_id)}`,
        },
        {
          id: "protocol",
          header: ` ${t("protocol", "Protocol")}:${t("port", "Port")}`,
          cell: ({ row }) =>
            `${row.original.protocol}:${getProtocolPort(row.original.server_id, row.original.protocol)}`,
        },
        {
          accessorKey: "tags",
          header: t("tags", "Tags"),
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {(row.original.tags || []).length === 0
                ? "—"
                : row.original.tags.map((tg) => (
                    <Badge key={tg} variant="outline">
                      {tg}
                    </Badge>
                  ))}
            </div>
          ),
        },
      ]}
      header={{
        title: t("inventoryTitle", "Node inventory"),
        toolbar: (
          <NodeForm
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                const body: API.CreateNodeRequest = {
                  name: values.name,
                  server_id: Number(values.server_id!),
                  protocol: values.protocol,
                  address: values.address,
                  port: Number(values.port!),
                  tags: values.tags || [],
                  enabled: false,
                };
                await createNode(body);
                toast.success(t("created", "Created"));
                ref.current?.refresh();
                fetchNodes();
                fetchTags();
                setLoading(false);
                return true;
              } catch {
                setLoading(false);
                return false;
              }
            }}
            title={t("drawerCreateTitle", "Create Node")}
            trigger={t("create", "Create")}
          />
        ),
      }}
      mobile={{
        getAriaLabel: (row) => String(row.name || row.id),
        render: (row) => (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="shrink-0">{row.id}</Badge>
                  <h2 className="truncate font-semibold text-base">
                    {row.name || "—"}
                  </h2>
                </div>
                <p className="mt-1 break-all font-mono text-muted-foreground text-sm">
                  {row.address || "—"}:{row.port || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  aria-label={t("enabled", "Enabled")}
                  checked={row.enabled}
                  onCheckedChange={async (value) => {
                    await toggleNodeStatus({ id: row.id, enable: value });
                    toast.success(
                      value
                        ? t("enabled_on", "Enabled")
                        : t("enabled_off", "Disabled")
                    );
                    ref.current?.refresh();
                    fetchNodes();
                    fetchTags();
                  }}
                />
                <StatusChip
                  dot={false}
                  tone={row.enabled ? "success" : "neutral"}
                >
                  {row.enabled
                    ? t("enabled_on", "Enabled")
                    : t("enabled_off", "Disabled")}
                </StatusChip>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm">
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <span className="text-muted-foreground">
                  {t("server", "Server")}
                </span>
                <span className="min-w-0 break-all text-right font-medium">
                  {getServerName(row.server_id)} ·{" "}
                  {getServerAddress(row.server_id)}
                </span>
              </div>
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <span className="text-muted-foreground">
                  {t("protocol", "Protocol")}
                </span>
                <span className="text-right font-medium">
                  {row.protocol}:{getProtocolPort(row.server_id, row.protocol)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(row.tags || []).length ? (
                row.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
          </div>
        ),
      }}
      onSort={async (source, target, items) => {
        // The node page loads the complete filtered list, so this re-indexes the
        // global order instead of only changing one visible page.
        const sourceIndex = items.findIndex(
          (item) => String(item.id) === source
        );
        const targetIndex = items.findIndex(
          (item) => String(item.id) === target
        );

        if (sourceIndex === -1 || targetIndex === -1) return items;

        const prevSortById = new Map(items.map((it) => [it.id, it.sort]));

        const next = items.slice();
        const [movedItem] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedItem!);

        // IMPORTANT:
        // Some installations have duplicate / empty `sort` values (commonly 0 or null)
        // which makes the order appear "random" after refresh and also makes
        // "swap sort values" strategies a no-op.
        //
        // To make the ordering stable, we re-index the current page to a strictly
        // increasing sequence.
        const numericSorts = items
          .map((it) => (typeof it.sort === "number" ? it.sort : Number.NaN))
          .filter((v) => Number.isFinite(v)) as number[];
        const baseSort = numericSorts.length ? Math.min(...numericSorts) : 0;

        const updatedItems = next.map((item, index) => ({
          ...item,
          sort: baseSort + index,
        }));

        const changedItems = updatedItems.filter(
          (item) => item.sort !== prevSortById.get(item.id)
        );

        if (changedItems.length > 0) {
          await resetSortWithNode({
            // Send all changed rows (within the current page) so backend can persist.
            sort: changedItems.map((item) => ({
              id: item.id,
              sort: item.sort,
            })) as API.SortItem[],
          });
          toast.success(t("sorted_success", "Sorted successfully"));
        }

        return updatedItems;
      }}
      pagination={false}
      params={[{ key: "search" }]}
      request={async (_pagination, filter) => {
        const list = await filterAllNodes(filter?.search);
        return { list, total: list.length };
      }}
    />
  );
}

function NodeRowActions({
  node,
  onChanged,
}: {
  node: API.Node;
  onChanged: () => void;
}) {
  const { t } = useTranslation("nodes");
  const deleteRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const [copying, setCopying] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdminActionMenu
        description={t(
          "actionsDescription",
          "Copy or remove this node without changing its current configuration."
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
          loadingLabel={t("copying", "Copying node")}
          onAction={async () => {
            setCopying(true);
            try {
              const {
                id: _id,
                sort: _sort,
                enabled: _enabled,
                updated_at: _updatedAt,
                created_at: _createdAt,
                ...rest
              } = node as any;
              await createNode({ ...rest, enabled: false });
              toast.success(t("copied", "Copied"));
              setOpen(false);
              onChanged();
            } catch {
              toast.error(t("copyFailed", "Unable to copy node"));
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
        cancelText={t("cancel", "Cancel")}
        confirmText={t("confirm", "Confirm")}
        description={t("confirmDeleteDesc", "This action cannot be undone.")}
        onConfirm={async () => {
          await deleteNode({ id: node.id } as any);
          toast.success(t("deleted", "Deleted"));
          onChanged();
        }}
        restoreFocusRef={moreTriggerRef}
        title={t("confirmDeleteTitle", "Delete this node?")}
        trigger={<Button className="hidden" ref={deleteRef} />}
      />
    </>
  );
}
