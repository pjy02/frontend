import { createLazyFileRoute } from "@tanstack/react-router";
import UnmatchedPaymentLogPage from "@/sections/log/payment-unmatched";

export const Route = createLazyFileRoute("/dashboard/log/payment-unmatched")({
  component: UnmatchedPaymentLogPage,
});
