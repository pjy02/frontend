import { createLazyFileRoute } from "@tanstack/react-router";
import { ProductRouteEditor } from "@/sections/product/route-editor";

export const Route = createLazyFileRoute("/dashboard/product/$productId")({
  component: ProductEditorRoute,
});

function ProductEditorRoute() {
  const { productId } = Route.useParams();
  return <ProductRouteEditor productId={Number(productId)} />;
}
