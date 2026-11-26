"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  postServerNodeCreate as createNode,
  postServerNodeOpenApiDelete as deleteNode,
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
import { AsyncSwitch, synchronizeTable } from "@/components/async-switch";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import {
  readNodeInventory,
  refreshNodeInventory,
  useNode,
} from "@/stores/node";
import { useServer } from "@/stores/server";
import {
  inventorySearchTerm,
  matchesInventorySearch,
} from "@/utils/inventory-search";
import {
  formatNodeEndpoint,
  type NodeAddressKind,
  nodeAddressKind,
} from "@/utils/node-address";
import NodeForm from "./node-form";
import { planNodeSort, sortNodes } from "./sort-nodes";

type NodeFilters = { search?: string; addressKind?: NodeAddressKind };

function NodeEndpoint({ address, port }: Pick<API.Node, "address" | "port">) {
  const { t } = useTranslation("nodes");
  const endpoint = formatNodeEndpoint(address || "", port);
  if (!endpoint) return <span>—</span>;

  async function copyAddress() {
    if (!endpoint) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(endpoint);
      } else {
        const field = document.createElement("textarea");
        field.value = endpoint;
        field.className = "fixed left-0 top-0 opacity-0";
        document.body.appendChild(field);
        field.select();
        try {
          if (!document.execCommand("copy"))
            throw new Error("Clipboard is unavailable");
        } finally {
          field.remove();
        }
      }
      toast.success(t("addressCopied", "Address copied"));
    } catch {
      toast.error(t("addressCopyFailed", "Could not copy the address"));
    }
  }

  const copyLabel = t("copyAddress", "Copy node address");
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 select-text font-mono text-sm [overflow-wrap:anywhere]">
        {endpoint}
      </span>
      <Button
        aria-label={copyLabel}
        className="size-8 shrink-0"
        onClick={copyAddress}
        size="icon"
        title={copyLabel}
        type="button"
        variant="ghost"
      >
        <Copy aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

export default function Nodes() {
  const { t } = useTranslation("nodes");
  const ref = useRef<ProTableActions>(null);
  const [loading, setLoading] = useState(false);

  // Use our zustand store for server data
  const { getServerName, getServerAddress, getProtocolPort } = useServer();
  const { fetchTags } = useNode();

  return (
    <div className="space-y-5">
      <PageHeader title={t("inventoryTitle", "Node inventory")} />
      <ProTable<API.Node, NodeFilters>
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
                  refreshNodeInventory();
                  ref.current?.refresh({ reason: "edit", rowIds: [row.id] });
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
              onChanged={(options) => {
                refreshNodeInventory();
                ref.current?.refresh(options);
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
                  const results = await Promise.allSettled(
                    rows.map((r) => deleteNode({ id: r.id } as any))
                  );
                  refreshNodeInventory();
                  ref.current?.refresh({
                    reason: "delete",
                    rowIds: rows.map((row) => row.id),
                  });
                  fetchTags();
                  if (results.some((result) => result.status === "rejected")) {
                    return false;
                  }
                  toast.success(t("deleted", "Deleted"));
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
              <AsyncSwitch
                checked={Boolean(row.original.enabled)}
                field="enabled"
                id={row.original.id}
                label={t("enabled", "Enabled")}
                onSync={async () => {
                  await readNodeInventory({ refresh: true });
                  await synchronizeTable(ref, row.original.id);
                  fetchTags();
                }}
                onWrite={async (checked) => {
                  await toggleNodeStatus({
                    id: row.original.id,
                    enable: checked,
                  });
                  toast.success(
                    checked
                      ? t("enabled_on", "Enabled")
                      : t("enabled_off", "Disabled")
                  );
                }}
                resource="node"
                status={(value) => (
                  <StatusChip
                    dot={false}
                    tone={value ? "success" : "neutral"}
                  >
                    {value
                      ? t("enabled_on", "Enabled")
                      : t("enabled_off", "Disabled")}
                  </StatusChip>
                )}
              />
            ),
          },
          { accessorKey: "name", header: t("name", "Name") },

          {
            id: "address_port",
            header: `${t("address", "Address")}:${t("port", "Port")}`,
            cell: ({ row }) => (
              <NodeEndpoint
                address={row.original.address}
                port={row.original.port}
              />
            ),
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
                  refreshNodeInventory();
                  ref.current?.refresh({ reason: "create" });
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
            <div className="admin-tablet-node-summary space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className="shrink-0">{row.id}</Badge>
                    <h2 className="truncate font-semibold text-base">
                      {row.name || "—"}
                    </h2>
                  </div>
                  <div className="mt-1 break-all font-mono text-muted-foreground text-sm">
                    <NodeEndpoint address={row.address} port={row.port} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AsyncSwitch
                    checked={Boolean(row.enabled)}
                    compact
                    field="enabled"
                    id={row.id}
                    label={t("enabled", "Enabled")}
                    onSync={async () => {
                      await readNodeInventory({ refresh: true });
                      await synchronizeTable(ref, row.id);
                      fetchTags();
                    }}
                    onWrite={async (checked) => {
                      await toggleNodeStatus({ id: row.id, enable: checked });
                      toast.success(
                        checked
                          ? t("enabled_on", "Enabled")
                          : t("enabled_off", "Disabled")
                      );
                    }}
                    resource="node"
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
                    {row.protocol}:
                    {getProtocolPort(row.server_id, row.protocol)}
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
          const inventory = sortNodes(await readNodeInventory());
          if (
            items.length !== inventory.length ||
            items.some(
              (item, index) =>
                item.id !== inventory[index]?.id ||
                item.sort !== inventory[index]?.sort
            )
          ) {
            throw new Error("The node order changed before sorting");
          }
          const next = planNodeSort(inventory, source, target);
          if (!next.writes.length) return items;
          await resetSortWithNode({ sort: next.writes });
          refreshNodeInventory();
          toast.success(t("sorted_success", "Sorted successfully"));
          return next.items;
        }}
        pagination={false}
        params={[
          { key: "search" },
          {
            key: "addressKind",
            placeholder: t("addressKind", "Address type"),
            options: [
              { label: "IPv4", value: "ipv4" },
              { label: "IPv6", value: "ipv6" },
              { label: t("hostname", "Domain"), value: "hostname" },
            ],
          },
        ]}
        request={async (_pagination, filter, { refresh, signal }) => {
          const nodes = await readNodeInventory({ refresh, signal });
          const term = inventorySearchTerm(filter?.search);
          const kind = filter?.addressKind;
          const list = sortNodes(
            nodes.filter(
              (node) =>
                (!term || matchesInventorySearch(node, term)) &&
                (!kind || nodeAddressKind(node.address || "") === kind)
            )
          );
          return { list, total: list.length };
        }}
        sortOnlyUnfiltered
      />
    </div>
  );
}

function NodeRowActions({
  node,
  onChanged,
}: {
  node: API.Node;
  onChanged: (options: Parameters<ProTableActions["refresh"]>[0]) => void;
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
              onChanged({ reason: "create" });
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
          onChanged({ reason: "delete", rowIds: [node.id] });
        }}
        restoreFocusRef={moreTriggerRef}
        title={t("confirmDeleteTitle", "Delete this node?")}
        trigger={<Button className="hidden" ref={deleteRef} />}
      />
    </>
  );
}
