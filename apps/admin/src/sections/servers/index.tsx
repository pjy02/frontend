"use client";

import { Link, useSearch } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import { cn } from "@workspace/ui/lib/utils";
import {
  postServerCreate as createServer,
  postServerOpenApiDelete as deleteServer,
  getServerList as filterServerList,
  getServerNodeConfig,
  postServerServerSort as resetSortWithServer,
  postServerNodeConfigUpdate as updateServerNodeConfig,
} from "@workspace/ui/services/admin/admin";
import { type RefObject, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { useNode } from "@/stores/node";
import { useServer } from "@/stores/server";
import DynamicMultiplier from "./dynamic-multiplier";
import OnlineUsersCell from "./online-users-cell";
import ServerConfig from "./server-config";
import ServerInstall from "./server-install";
import ServerNodeConfig from "./server-node-config";

function PctBar({ value }: { value: number }) {
  const v = value.toFixed(2);
  const widthClass =
    value >= 90
      ? "w-[90%]"
      : value >= 80
        ? "w-4/5"
        : value >= 70
          ? "w-[70%]"
          : value >= 60
            ? "w-3/5"
            : value >= 50
              ? "w-1/2"
              : value >= 40
                ? "w-2/5"
                : value >= 30
                  ? "w-[30%]"
                  : value >= 20
                    ? "w-1/5"
                    : value >= 10
                      ? "w-[10%]"
                      : "w-0";
  return (
    <div className="min-w-20 sm:min-w-24">
      <div className="text-xs leading-none">{v}%</div>
      <div className="h-1.5 w-full rounded bg-muted">
        <div className={cn("h-1.5 rounded bg-primary", widthClass)} />
      </div>
    </div>
  );
}

function RegionIpCell({
  country,
  city,
  ip,
  notAvailableText,
}: {
  country?: string;
  city?: string;
  ip?: string;
  notAvailableText: string;
}) {
  const region =
    [country, city].filter(Boolean).join(" / ") || notAvailableText;
  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline">{region}</Badge>
      <Badge variant="secondary">{ip || notAvailableText}</Badge>
    </div>
  );
}

interface ServersProps {
  actionRef?: RefObject<ProTableActions | null>;
}

export default function Servers({ actionRef }: ServersProps) {
  const { t } = useTranslation("servers");
  const routeSearch = useSearch({ strict: false });
  const { isServerReferencedByNodes } = useNode();
  const { fetchServers } = useServer();

  const internalActionRef = useRef<ProTableActions>(null);
  const ref = actionRef ?? internalActionRef;

  return (
    <div className="space-y-6">
      <PageHeader
        description={t(
          "pageDescription",
          "Manage server capacity, connectivity, protocols, and node runtime configuration."
        )}
        eyebrow={t("infrastructure", "Infrastructure")}
        title={t("pageTitle", "Servers")}
      />
      <div className="admin-server-shortcuts grid grid-cols-2 gap-2 sm:gap-3">
        <DynamicMultiplier />
        <ServerConfig />
      </div>
      <ProTable<API.Server, { search: string }>
        action={ref}
        actions={{
          render: (row) => [
            <Button asChild key="edit">
              <Link
                params={{ serverId: String(row.id) }}
                resetScroll={false}
                search={routeSearch}
                to="/dashboard/servers/$serverId"
              >
                {t("edit", "Edit")}
              </Link>
            </Button>,
            <ServerInstall key="install" server={row} />,
            <ServerNodeConfig key="node-config" server={row} />,
            <ConfirmButton
              cancelText={t("cancel", "Cancel")}
              confirmText={t("confirm", "Confirm")}
              description={t(
                "confirmDeleteDesc",
                "This action cannot be undone."
              )}
              key="delete"
              onConfirm={async () => {
                await deleteServer({ id: row.id } as API.DeleteServerRequest);
                toast.success(t("deleted", "Deleted"));
                ref.current?.refresh();
                fetchServers();
              }}
              title={t("confirmDeleteTitle", "Delete this server?")}
              trigger={
                <Button
                  disabled={isServerReferencedByNodes(row.id)}
                  variant="destructive"
                >
                  {t("delete", "Delete")}
                </Button>
              }
            />,
            <Button
              key="copy"
              onClick={async () => {
                const {
                  id: _id,
                  created_at: _created_at,
                  updated_at: _updated_at,
                  last_reported_at: _last_reported_at,
                  status: _status,
                  ...others
                } = row as Record<string, unknown>;
                const body: API.CreateServerRequest = {
                  name: others.name as string,
                  country: others.country as string,
                  city: others.city as string,
                  address: others.address as string,
                  protocols: (others.protocols as API.Protocol[]) || [],
                };
                const [createResp, configResp] = await Promise.all([
                  createServer(body),
                  getServerNodeConfig({ server_id: row.id }),
                ]);
                const newServerId = (
                  createResp.data as { data?: { id?: number } }
                ).data?.id;
                const override = configResp.data?.data?.override;

                if (newServerId && override) {
                  await updateServerNodeConfig({
                    server_id: newServerId,
                    inherit_ip_strategy: override.inherit_ip_strategy,
                    ip_strategy: override.ip_strategy,
                    inherit_dns: override.inherit_dns,
                    dns: override.dns || [],
                    inherit_block: override.inherit_block,
                    block: override.block || [],
                    inherit_outbound: override.inherit_outbound,
                    outbound: override.outbound || [],
                  });
                }

                toast.success(t("copied", "Copied"));
                ref.current?.refresh();
                fetchServers();
              }}
              variant="outline"
            >
              {t("copy", "Copy")}
            </Button>,
          ],
          batchRender(rows) {
            const hasReferencedServers = rows.some((row) =>
              isServerReferencedByNodes(row.id)
            );
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
                    rows.map((r) => deleteServer({ id: r.id }))
                  );
                  toast.success(t("deleted", "Deleted"));
                  ref.current?.refresh();
                  fetchServers();
                }}
                title={t("confirmDeleteTitle", "Delete this server?")}
                trigger={
                  <Button disabled={hasReferencedServers} variant="destructive">
                    {t("delete", "Delete")}
                  </Button>
                }
              />,
            ];
          },
        }}
        columns={[
          {
            accessorKey: "id",
            header: t("id", "ID"),
            cell: ({ row }) => <Badge>{row.getValue("id")}</Badge>,
          },
          { accessorKey: "name", header: t("name", "Name") },
          {
            id: "region_ip",
            header: t("address", "Address"),
            cell: ({ row }) => (
              <RegionIpCell
                city={row.original.city as unknown as string}
                country={row.original.country as unknown as string}
                ip={row.original.address as unknown as string}
                notAvailableText={t("notAvailable", "Not Available")}
              />
            ),
          },
          {
            accessorKey: "protocols",
            header: t("protocols", "Protocols"),
            cell: ({ row }) => {
              const list = row.original.protocols.filter(
                (p) => p.enable
              ) as API.Protocol[];
              if (!list.length) return "—";
              return (
                <div className="flex flex-col gap-1">
                  {list.map((p, idx) => {
                    const ratio = Number(p.ratio ?? 1) || 1;
                    return (
                      <div className="flex items-center gap-2" key={idx}>
                        <Badge variant="outline">{ratio.toFixed(2)}x</Badge>
                        <Badge variant="secondary">{p.type}</Badge>
                        <Badge variant="secondary">{p.port}</Badge>
                      </div>
                    );
                  })}
                </div>
              );
            },
          },

          {
            id: "status",
            header: t("status", "Status"),
            cell: ({ row }) => {
              const offline = row.original.status.status === "offline";
              return (
                <StatusChip tone={offline ? "neutral" : "success"}>
                  {offline ? t("offline", "Offline") : t("online", "Online")}
                </StatusChip>
              );
            },
          },
          {
            id: "cpu",
            header: t("cpu", "CPU"),
            cell: ({ row }) => (
              <PctBar
                value={(row.original.status?.cpu as unknown as number) ?? 0}
              />
            ),
          },
          {
            id: "mem",
            header: t("memory", "Memory"),
            cell: ({ row }) => (
              <PctBar
                value={(row.original.status?.mem as unknown as number) ?? 0}
              />
            ),
          },
          {
            id: "disk",
            header: t("disk", "Disk"),
            cell: ({ row }) => (
              <PctBar
                value={(row.original.status?.disk as unknown as number) ?? 0}
              />
            ),
          },

          {
            id: "online_users",
            header: t("onlineUsers", "Online Users"),
            cell: ({ row }) => (
              <OnlineUsersCell
                status={row.original.status as API.ServerStatus}
              />
            ),
          },
        ]}
        header={{
          title: t("inventoryTitle", "Server inventory"),
          toolbar: (
            <div className="flex gap-2">
              <Button asChild>
                <Link
                  resetScroll={false}
                  search={routeSearch}
                  to="/dashboard/servers/new"
                >
                  {t("create", "Create")}
                </Link>
              </Button>
            </div>
          ),
        }}
        mobile={{
          getAriaLabel: (row) => String(row.name || row.id),
          render: (row) => {
            const offline = row.status?.status === "offline";
            const protocols = (row.protocols || []).filter(
              (protocol) => protocol.enable
            );
            const onlineUsers = Array.isArray(row.status?.online)
              ? row.status.online.length
              : Number(row.status?.online || 0);

            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="shrink-0">{row.id}</Badge>
                      <h2 className="truncate font-semibold text-base">
                        {row.name || t("notAvailable", "Not Available")}
                      </h2>
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {[row.country, row.city].filter(Boolean).join(" · ") ||
                        t("notAvailable", "Not Available")}
                    </p>
                  </div>
                  <StatusChip tone={offline ? "neutral" : "success"}>
                    {offline ? t("offline", "Offline") : t("online", "Online")}
                  </StatusChip>
                </div>

                <div className="rounded-lg bg-muted/45 px-3 py-2 font-mono text-sm [overflow-wrap:anywhere]">
                  {row.address || t("notAvailable", "Not Available")}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {protocols.length ? (
                    protocols.map((protocol, index) => (
                      <Badge
                        key={`${protocol.type}-${protocol.port}-${index}`}
                        variant="outline"
                      >
                        {protocol.type} · {protocol.port} ·{" "}
                        {Number(protocol.ratio || 1).toFixed(2)}x
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 border-y py-3">
                  <div className="min-w-0 space-y-1.5">
                    <span className="text-muted-foreground text-xs">
                      {t("cpu", "CPU")}
                    </span>
                    <PctBar value={Number(row.status?.cpu || 0)} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <span className="text-muted-foreground text-xs">
                      {t("memory", "Memory")}
                    </span>
                    <PctBar value={Number(row.status?.mem || 0)} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <span className="text-muted-foreground text-xs">
                      {t("disk", "Disk")}
                    </span>
                    <PctBar value={Number(row.status?.disk || 0)} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("onlineUsers", "Online Users")}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {onlineUsers}
                  </span>
                </div>
              </div>
            );
          },
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
            const newSort =
              originalSort !== undefined ? originalSort : item.sort;
            return { ...item, sort: newSort };
          });

          const changedItems = updatedItems.filter(
            (item, index) => item.sort !== items[index]?.sort
          );

          if (changedItems.length > 0) {
            resetSortWithServer({
              sort: changedItems.map((item) => ({
                id: item.id,
                sort: item.sort,
              })) as API.SortItem[],
            });
            toast.success(t("sorted_success", "Sorted successfully"));
          }
          return updatedItems;
        }}
        params={[{ key: "search" }]}
        request={async (pagination, filter) => {
          const { data } = await filterServerList({
            page: pagination.page,
            size: pagination.size,
            search: filter?.search || undefined,
          });
          const list = (data?.data?.list || []) as API.Server[];
          const total = (data?.data?.total ?? list.length) as number;
          return { list, total };
        }}
      />
    </div>
  );
}
