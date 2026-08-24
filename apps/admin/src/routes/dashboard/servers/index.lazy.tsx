import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/dashboard/servers/")({
  component: ServerListIndexRoute,
});

function ServerListIndexRoute() {
  return null;
}
