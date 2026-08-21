import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { updateSubscribe } from "@workspace/ui/services/admin/subscribe";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LoadingState, NotFoundState } from "@/components/states";
import { useSubscribe } from "@/stores/subscribe";
import SubscribeForm from "./subscribe-form";

interface ProductRouteEditorProps {
  productId: number;
}

export function ProductRouteEditor({ productId }: ProductRouteEditorProps) {
  const { t } = useTranslation("product");
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const { fetchSubscribes, getSubscribeById, loaded } = useSubscribe();
  const [saving, setSaving] = useState(false);
  const product = getSubscribeById(productId);

  const close = () =>
    navigate({
      replace: true,
      search,
      to: "/dashboard/product",
    });

  if (!loaded) {
    return (
      <LoadingState
        className="mx-auto w-full max-w-5xl"
        label={t("loadingProduct", "Loading product")}
        rows={8}
      />
    );
  }

  if (!product) {
    return (
      <NotFoundState
        action={
          <Button asChild variant="outline">
            <Link search={search} to="/dashboard/product">
              {t("backToProducts", "Back to products")}
            </Link>
          </Button>
        }
        description={t(
          "productNotFoundDescription",
          "The product may have been removed or is no longer available."
        )}
        title={t("productNotFound", "Product not found")}
      />
    );
  }

  return (
    <SubscribeForm<API.SubscribeItem>
      initialValues={product}
      loading={saving}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
      onSubmit={async (values) => {
        setSaving(true);
        try {
          await updateSubscribe({
            ...product,
            ...values,
          } as API.UpdateSubscribeRequest);
          toast.success(t("updateSuccess"));
          await fetchSubscribes();
          return true;
        } catch {
          return false;
        } finally {
          setSaving(false);
        }
      }}
      open
      title={t("editSubscribe")}
    />
  );
}
