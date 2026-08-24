import { createLazyFileRoute, Outlet } from "@tanstack/react-router";
import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import { useRef } from "react";
import Servers from "@/sections/servers";
import { ServerListActionProvider } from "@/sections/servers/list-context";

export const Route = createLazyFileRoute("/dashboard/servers")({
  component: ServersRouteLayout,
});

function ServersRouteLayout() {
  const actionRef = useRef<ProTableActions>(null);

  return (
    <ServerListActionProvider actionRef={actionRef}>
      <Servers actionRef={actionRef} />
      <Outlet />
    </ServerListActionProvider>
  );
}
