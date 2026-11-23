import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  postServerCreate as createServer,
  postServerUpdate as updateServer,
} from "@workspace/ui/services/admin/admin";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRouteTableAction } from "@/components/route-table-context";
import { ErrorState, LoadingState, NotFoundState } from "@/components/states";
import { useRouteWorkspaceExit } from "@/components/use-route-workspace-exit";
import { refreshServerInventory, useServer } from "@/stores/server";
import ServerForm from "./server-form";

interface ServerRouteEditorProps {
  serverId?: number;
}

export function ServerRouteEditor({ serverId }: ServerRouteEditorProps) {
  const { t } = useTranslation("servers");
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const { fetchServers, getServerById, loaded, loading, loadFailed } =
    useServer();
  const listAction = useRouteTableAction();
  const [saving, setSaving] = useState(false);
  const server = serverId === undefined ? undefined : getServerById(serverId);

  const close = () =>
    navigate({
      replace: true,
      resetScroll: false,
      search,
      to: "/dashboard/servers",
    });
  const exit = useRouteWorkspaceExit(close);

  if (serverId !== undefined && !server && (loading || !loaded)) {
    return (
      <LoadingState
        className="mx-auto w-full max-w-5xl"
        label={t("loadingServer", "Loading server")}
        rows={8}
      />
    );
  }

  if (serverId !== undefined && loadFailed && !server) {
    return (
      <ErrorState
        description={t(
          "serverReadFailedDescription",
          "Retry to load the server details."
        )}
        onRetry={fetchServers}
        retryLabel={t("components:read.retry", "Retry")}
        title={t("serverReadFailed", "Could not load the server")}
      />
    );
  }

  if (serverId !== undefined && !server) {
    return (
      <NotFoundState
        action={
          <Button asChild variant="outline">
            <Link resetScroll={false} search={search} to="/dashboard/servers">
              {t("backToServers", "Back to servers")}
            </Link>
          </Button>
        }
        description={t(
          "serverNotFoundDescription",
          "The server may have been removed or is no longer available."
        )}
        title={t("serverNotFound", "Server not found")}
      />
    );
  }

  const isEditing = Boolean(server);

  return (
    <ServerForm
      initialValues={server}
      loading={saving}
      onAfterClose={exit.onAfterClose}
      onOpenChange={exit.onOpenChange}
      onSubmit={async (values) => {
        if (server && (loadFailed || loading)) return false;
        setSaving(true);
        try {
          if (server) {
            await updateServer({
              id: server.id,
              ...(values as unknown as Omit<API.UpdateServerRequest, "id">),
            });
            toast.success(t("updated", "Updated"));
          } else {
            await createServer(values as unknown as API.CreateServerRequest);
            toast.success(t("created", "Created"));
          }
          await refreshServerInventory();
          listAction?.current?.refresh({
            reason: server ? "edit" : "create",
            rowIds: server ? [server.id] : undefined,
          });
          return true;
        } finally {
          setSaving(false);
        }
      }}
      open={exit.open}
      readWarning={
        isEditing && loadFailed ? (
          <ErrorState
            description={t(
              "serverReadStale",
              "You are viewing the last loaded server settings. Refresh before saving."
            )}
            onRetry={fetchServers}
            retryLabel={t("components:read.retry", "Retry")}
            title={t("serverReadFailed", "Could not load the server")}
          />
        ) : undefined
      }
      saveDisabled={isEditing && (loadFailed || loading)}
      title={
        isEditing
          ? t("drawerEditTitle", "Edit Server")
          : t("drawerCreateTitle", "Create Server")
      }
    />
  );
}
