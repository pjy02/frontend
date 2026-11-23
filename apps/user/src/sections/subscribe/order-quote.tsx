import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  postV1PublicOrderPre,
  postV1PublicPortalPre,
} from "@workspace/ui/services/user/user";
import { useTranslation } from "react-i18next";
import { useAvailablePaymentMethods } from "./payment-methods";

export function useOrderQuote(
  kind: "guest" | "purchase" | "renewal",
  { subscribe_id, quantity, payment, coupon }: API.PrePurchaseOrderRequest,
  options: { open: boolean; renewalId?: number }
) {
  const methods = useAvailablePaymentMethods(kind !== "guest", options.open);
  const methodReady = Boolean(
    methods.isSuccess && methods.data?.some((item) => item.id === payment)
  );
  const enabled = options.open && subscribe_id > 0 && methodReady;
  const request = { subscribe_id, quantity, payment, coupon };
  const quote = useQuery({
    enabled,
    queryKey: ["orderQuote", kind, options.renewalId, request],
    queryFn: async ({ signal }) => {
      const requestOptions = { signal, skipErrorHandler: true };
      const response =
        kind === "guest"
          ? await postV1PublicPortalPre(request, requestOptions)
          : await postV1PublicOrderPre(request, requestOptions);
      const data = response.data.data;
      if (!(data && Number.isFinite(data.amount))) {
        throw new Error("Order quote is missing");
      }
      return data;
    },
    retry: false,
  });
  const confirmed = enabled && quote.isSuccess && !quote.isFetching;
  return {
    confirmed,
    data: confirmed ? quote.data : undefined,
    methods,
    quote,
  };
}

export function OrderQuoteFeedback({
  state: { confirmed, methods, quote },
}: {
  state: ReturnType<typeof useOrderQuote>;
}) {
  const { t } = useTranslation("subscribe");
  const failed = methods.isError ? methods : quote.isError ? quote : undefined;
  if (failed) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="alert">
        <p className="text-destructive text-sm">
          {methods.isError
            ? t("quote.paymentMethodsFailed", "Could not load payment methods.")
            : t("quote.failed", "Could not confirm the current price.")}
        </p>
        <Button
          disabled={failed.isFetching}
          onClick={() => failed.refetch()}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("quote.retry", "Retry")}
        </Button>
      </div>
    );
  }
  if (methods.isSuccess && methods.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("quote.noPaymentMethods", "No payment methods are available.")}
      </p>
    );
  }
  if (!confirmed && (methods.isFetching || quote.isFetching)) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("quote.loading", "Confirming the price…")}
      </p>
    );
  }
  return null;
}
