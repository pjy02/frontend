import { createLazyFileRoute, Outlet } from "@tanstack/react-router";
import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import { useRef } from "react";
import { RouteTableActionProvider } from "@/components/route-table-context";
import Product from "@/sections/product";

export const Route = createLazyFileRoute("/dashboard/product")({
  component: ProductRouteLayout,
});

function ProductRouteLayout() {
  const actionRef = useRef<ProTableActions>(null);

  return (
    <RouteTableActionProvider actionRef={actionRef}>
      <Product actionRef={actionRef} />
      <Outlet />
    </RouteTableActionProvider>
  );
}
