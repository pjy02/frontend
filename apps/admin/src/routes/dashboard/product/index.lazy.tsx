import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/dashboard/product/")({
  component: ProductListIndexRoute,
});

function ProductListIndexRoute() {
  return null;
}
