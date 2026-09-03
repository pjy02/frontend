import { createLazyFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import DashboardLayout from "@/layout";

export const Route = createLazyFileRoute("/dashboard")({
  component: DashboardLayout,
  notFoundComponent: () => <NotFoundPage contained />,
});
