import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  createServer,
  updateServer,
} from "@workspace/ui/services/admin/server";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LoadingState, NotFoundState } from "@/components/states";
import { useServer } from "@/stores/server";
import ServerForm from "./server-form";

interface ServerRouteEditorProps {
  serverId?: number;
}

export function ServerRouteEditor({ serverId }: ServerRouteEditorProps) {
  const { t } = useTranslation("servers");
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const { fetchServers, getServerById, loaded } = useServer();
  const [saving, setSaving] = useState(false);
  const server = serverId === undefined ? undefined : getServerById(serverId);

  const close = () =>
    navigate({
      replace: true,
      search,
      to: "/dashboard/servers",
    });

  if (serverId !== undefined && !loaded) {
    return (
      <LoadingState
        className="mx-auto w-full max-w-5xl"
        label={t("loadingServer", "Loading server")}
        rows={8}
      />
    );
  }

  if (serverId !== undefined && !server) {
    return (
      <NotFoundState
        action={
          <Button asChild variant="outline">
            <Link search={search} to="/dashboard/servers">
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
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
      onSubmit={async (values) => {
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
          await fetchServers();
          return true;
        } catch {
          return false;
        } finally {
          setSaving(false);
        }
      }}
      open
      title={
        isEditing
          ? t("drawerEditTitle", "Edit Server")
          : t("drawerCreateTitle", "Create Server")
      }
    />
  );
}
