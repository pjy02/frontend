"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Icon } from "@workspace/ui/composed/icon";
import { getCookie } from "@workspace/ui/lib/cookies";
import {
  postV1PublicPortalOrderCheckout as purchaseCheckout,
  getV1PublicPortalOrderStatus as queryPurchaseOrder,
} from "@workspace/ui/services/user/user";
import { formatDate } from "@workspace/ui/utils/formatting";
import { useCountDown } from "ahooks";
import { addMinutes, format } from "date-fns";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SubscribeBilling } from "@/sections/subscribe/billing";
import { SubscribeDetail } from "@/sections/subscribe/detail";
import StripePayment from "@/sections/user/payment/stripe";
import { useGlobalStore } from "@/stores/global";
import { setAuthorization } from "@/utils/common";
import {
  clearGuestCheckout,
  isCheckoutAccessError,
  readGuestCheckout,
} from "./checkout-session";

export default function Order() {
  const { t } = useTranslation("order");
  const { getUserInfo } = useGlobalStore();
  const { order_no: orderNo } = useSearch({
    from: "/(main)/purchasing/order/",
  });
  const token = orderNo ? readGuestCheckout(orderNo) : undefined;
  const canOpen = Boolean(orderNo && (token || getCookie("Authorization")));
  const openedCheckout = useRef<string | undefined>(undefined);

  const status = useQuery({
    enabled: canOpen,
    queryKey: ["queryPurchaseOrder", orderNo],
    queryFn: async ({ signal }) => {
      if (!orderNo) throw new Error("Order number is missing");
      const { data } = await queryPurchaseOrder(
        { order_no: orderNo, checkout_token: token },
        { signal, skipErrorHandler: true }
      );
      if (!data.data) throw new Error("Order status is missing");
      return data.data;
    },
    refetchInterval: ({ state }) =>
      !state.error && state.data?.status === 1 ? 3000 : false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data } = status;
  const checkout = useQuery({
    enabled: canOpen && status.isSuccess && data?.status === 1,
    queryKey: ["guestCheckout", orderNo],
    queryFn: async ({ signal }) => {
      const { data } = await purchaseCheckout(
        {
          orderNo,
          checkout_token: token,
          returnUrl: window.location.href,
        },
        { signal, skipErrorHandler: true }
      );
      if (!data.data) throw new Error("Payment instructions are missing");
      return data.data;
    },
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: payment } = checkout;

  useEffect(() => {
    if (!(orderNo && token && data?.token)) return;
    if (!getCookie("Authorization")) {
      setAuthorization(data.token);
      getUserInfo();
    }
    if (getCookie("Authorization") === data.token) clearGuestCheckout(orderNo);
  }, [data?.token, getUserInfo, orderNo, token]);

  useEffect(() => {
    if (!orderNo || data?.status !== 1 || payment?.type !== "url") return;
    const url = payment.checkout_url;
    if (!url || openedCheckout.current === orderNo) return;
    openedCheckout.current = orderNo;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [data?.status, orderNo, payment]);

  const [countDown, formattedRes] = useCountDown({
    targetDate:
      data &&
      format(addMinutes(data?.created_at, 15), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
  });

  const { hours, minutes, seconds } = formattedRes;

  const countdownDisplay =
    countDown > 0 ? (
      <>
        {hours.toString().length === 1 ? `0${hours}` : hours} :{" "}
        {minutes.toString().length === 1 ? `0${minutes}` : minutes} :{" "}
        {seconds.toString().length === 1 ? `0${seconds}` : seconds}
      </>
    ) : (
      t("timeExpired", "Time Expired")
    );

  const failed = status.isError
    ? status
    : data?.status === 1 && checkout.isError
      ? checkout
      : undefined;
  const unavailable = !canOpen || isCheckoutAccessError(failed?.error);
  if (unavailable || failed) {
    return (
      <main className="container py-16">
        <Card>
          <CardContent className="space-y-4" role="alert">
            <p>
              {unavailable
                ? t(
                    "guestCheckout.unavailable",
                    "This checkout session is unavailable. Open the order in the original tab, or sign in to view your orders."
                  )
                : t(
                    "guestCheckout.failed",
                    "Could not load the order or its payment details."
                  )}
            </p>
            {orderNo && (
              <p>
                {t("orderNumber", "Order Number")} {orderNo}
              </p>
            )}
            {unavailable ? (
              <Button asChild variant="outline">
                <Link to="/auth">{t("guestCheckout.signIn", "Sign in")}</Link>
              </Button>
            ) : (
              <Button
                disabled={failed?.isFetching}
                onClick={() => failed?.refetch()}
                variant="outline"
              >
                {t("guestCheckout.retry", "Retry")}
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!data) {
    return (
      <main aria-busy="true" className="container py-16">
        <p role="status">{t("guestCheckout.loading", "Loading order…")}</p>
      </main>
    );
  }

  return (
    <main className="container lg:mt-16">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="order-2 xl:order-1">
          <CardHeader className="flex flex-row items-start bg-muted/50">
            <div className="grid gap-0.5">
              <CardTitle className="flex flex-col text-lg">
                {t("orderNumber", "Order Number")}
                <span>{data?.order_no}</span>
              </CardTitle>
              <CardDescription>
                {t("createdAt", "Created At")}: {formatDate(data?.created_at)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 text-sm">
            <div className="font-semibold">
              {t("paymentMethod", "Payment Method")}
            </div>
            <dl className="grid gap-3">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  <Badge>{data.payment?.name || data.payment?.platform}</Badge>
                </dt>
              </div>
            </dl>
            <Separator />

            {data.subscribe && (
              <SubscribeDetail
                subscribe={{
                  ...data?.subscribe,
                  quantity: data?.quantity,
                }}
              />
            )}
            <Separator />
            <SubscribeBilling
              order={{
                ...data,
                unit_price: data?.subscribe?.unit_price,
                show_original_price: data?.subscribe?.show_original_price,
              }}
            />
          </CardContent>
        </Card>
        <Card className="order-1 flex flex-auto items-center justify-center xl:order-2">
          <CardContent className="py-16">
            {data.status === 1 && !payment && (
              <p role="status">
                {t("guestCheckout.loadingPayment", "Loading payment details…")}
              </p>
            )}
            {data?.status && [2, 5].includes(data?.status) && (
              <div className="flex flex-col items-center gap-8 text-center">
                <h3 className="font-bold text-2xl tracking-tight">
                  {t("paymentSuccess", "Payment Successful")}
                </h3>
                <Icon
                  className="text-7xl text-green-500"
                  icon="mdi:success-circle-outline"
                />
                <div className="flex gap-4">
                  <Button asChild>
                    <Link to="/dashboard">
                      {t("subscribeNow", "Subscribe Now")}
                    </Link>
                  </Button>
                  <Button variant="outline">
                    <Link to="/document">
                      {t("viewDocument", "View Document")}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {data?.status === 1 && payment?.type === "url" && (
              <div className="flex flex-col items-center gap-8 text-center">
                <h3 className="font-bold text-2xl tracking-tight">
                  {t("waitingForPayment", "Waiting for Payment")}
                </h3>
                <p className="flex items-center font-bold text-3xl">
                  {countdownDisplay}
                </p>
                <Icon
                  className="text-7xl text-muted-foreground"
                  icon="mdi:access-time"
                />
                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      if (payment?.checkout_url) {
                        window.location.href = payment?.checkout_url;
                      }
                    }}
                  >
                    {t("goToPayment", "Go to Payment")}
                  </Button>
                  <Button variant="outline">
                    <Link search={{ id: 0 }} to="/">
                      {t("productList", "Product List")}
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {data?.status === 1 && payment?.type === "qr" && (
              <div className="flex flex-col items-center gap-8 text-center">
                <h3 className="font-bold text-2xl tracking-tight">
                  {t("scanToPay", "Scan to Pay")}
                </h3>
                <p className="flex items-center font-bold text-3xl">
                  {countdownDisplay}
                </p>
                <QRCodeCanvas
                  imageSettings={{
                    src: "./assets/payment/alipay_f2f.svg",
                    width: 24,
                    height: 24,
                    excavate: true,
                  }}
                  size={208}
                  value={payment?.checkout_url || ""}
                />
                <div className="flex gap-4">
                  <Button asChild>
                    <Link to="/subscribe">
                      {t("productList", "Product List")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/order">{t("orderList", "Order List")}</Link>
                  </Button>
                </div>
              </div>
            )}

            {data?.status === 1 && payment?.type === "stripe" && (
              <div className="flex flex-col items-center gap-8 text-center">
                <h3 className="font-bold text-2xl tracking-tight">
                  {t("waitingForPayment", "Waiting for Payment")}
                </h3>
                <p className="flex items-center font-bold text-3xl">
                  {countdownDisplay}
                </p>
                {payment.stripe && <StripePayment {...payment.stripe} />}
                {/* <div className='flex gap-4'>
               <Button asChild>
                  <Link to='/subscribe'>{t('productList')}</Link>
                </Button>
                <Button asChild variant='outline'>
                  <Link to='/order'>{t('orderList')}</Link>
                </Button>
              </div> */}
              </div>
            )}

            {data?.status && [3, 4].includes(data?.status) && (
              <div className="flex flex-col items-center gap-8 text-center">
                <h3 className="font-bold text-2xl tracking-tight">
                  {t("orderClosed", "Order Closed")}
                </h3>
                <Icon className="text-7xl text-red-500" icon="mdi:cancel" />
                <div className="flex gap-4">
                  <Button asChild>
                    <Link to="/subscribe">
                      {t("productList", "Product List")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/order">{t("orderList", "Order List")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
