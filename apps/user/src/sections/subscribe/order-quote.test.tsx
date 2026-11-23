// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useOrderQuote } from "./order-quote";

const services = vi.hoisted(() => ({
  methods: vi.fn(),
  quote: vi.fn(),
}));
vi.mock("@workspace/ui/services/user/user", () => ({
  getV1PublicPortalPaymentMethod: services.methods,
  postV1PublicOrderPre: services.quote,
  postV1PublicPortalPre: services.quote,
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("requests a new quote when the plan changes and never forwards account fields", async () => {
  services.methods.mockResolvedValue({ data: { data: { list: [{ id: 8 }] } } });
  services.quote.mockImplementation(async ({ subscribe_id }) => ({
    data: { data: { amount: subscribe_id * 1000 } },
  }));
  const client = new QueryClient();
  const { result, rerender } = renderHook(
    ({ id }) =>
      useOrderQuote(
        "guest",
        {
          subscribe_id: id,
          payment: 8,
          quantity: 1,
          coupon: "",
          ...{ identifier: "fixture@example.com", password: "fixture-only" },
        },
        { open: true }
      ),
    {
      initialProps: { id: 1 },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  );
  await waitFor(() => expect(result.current.data?.amount).toBe(1000));
  rerender({ id: 2 });
  expect(result.current.confirmed).toBe(false);
  await waitFor(() => expect(result.current.data?.amount).toBe(2000));
  expect(services.quote).toHaveBeenLastCalledWith(
    { subscribe_id: 2, quantity: 1, payment: 8, coupon: "" },
    expect.objectContaining({ skipErrorHandler: true })
  );
});

it("blocks the purchase when the new quote fails, even if a previous quote succeeded", async () => {
  services.methods.mockResolvedValue({
    data: { data: { list: [{ id: -1 }] } },
  });
  services.quote.mockResolvedValueOnce({ data: { data: { amount: 0 } } });
  services.quote.mockRejectedValueOnce(new Error("quote failed"));
  const client = new QueryClient();
  const { result, rerender } = renderHook(
    ({ coupon }) =>
      useOrderQuote(
        "renewal",
        { subscribe_id: 1, payment: -1, quantity: 1, coupon },
        { open: true, renewalId: 4 }
      ),
    {
      initialProps: { coupon: "" },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  );
  await waitFor(() => expect(result.current.confirmed).toBe(true));
  expect(result.current.data?.amount).toBe(0);
  rerender({ coupon: "updated" });
  await waitFor(() => expect(result.current.quote.isError).toBe(true));
  expect(result.current.confirmed).toBe(false);
  expect(result.current.data).toBeUndefined();
});
