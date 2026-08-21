import { createLazyFileRoute } from "@tanstack/react-router";
import { ServerRouteEditor } from "@/sections/servers/route-editor";

export const Route = createLazyFileRoute("/dashboard/servers/new")({
  component: ServerRouteEditor,
});
