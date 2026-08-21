import { createLazyFileRoute } from "@tanstack/react-router";
import { ServerRouteEditor } from "@/sections/servers/route-editor";

export const Route = createLazyFileRoute("/dashboard/servers/$serverId")({
  component: ServerEditorRoute,
});

function ServerEditorRoute() {
  const { serverId } = Route.useParams();
  return <ServerRouteEditor serverId={Number(serverId)} />;
}
