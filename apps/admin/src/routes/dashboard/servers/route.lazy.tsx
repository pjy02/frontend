import { createLazyFileRoute, Outlet } from "@tanstack/react-router";
import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import { useRef } from "react";
import { RouteTableActionProvider } from "@/components/route-table-context";
import Servers from "@/sections/servers";

export const Route = createLazyFileRoute("/dashboard/servers")({
  component: ServersRouteLayout,
});

function ServersRouteLayout() {
  const actionRef = useRef<ProTableActions>(null);

  return (
    <RouteTableActionProvider actionRef={actionRef}>
      <Servers actionRef={actionRef} />
      <Outlet />
    </RouteTableActionProvider>
  );
}
