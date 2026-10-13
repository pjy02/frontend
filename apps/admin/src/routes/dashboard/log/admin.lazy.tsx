import { createLazyFileRoute } from "@tanstack/react-router";
import AdminActionLogPage from "@/sections/log/admin";

export const Route = createLazyFileRoute("/dashboard/log/admin")({
  component: AdminActionLogPage,
});
