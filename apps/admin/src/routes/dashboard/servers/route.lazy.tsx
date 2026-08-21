import { createLazyFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/dashboard/servers")({
  component: Outlet,
});
