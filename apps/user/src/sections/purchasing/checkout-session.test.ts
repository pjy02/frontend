// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGuestCheckout,
  isCheckoutAccessError,
  readGuestCheckout,
  saveGuestCheckout,
} from "./checkout-session";

afterEach(() => {
  vi.restoreAllMocks();
  clearGuestCheckout("first-order");
  clearGuestCheckout("second-order");
});

describe("guest checkout credentials", () => {
  it("keeps each order's token in this tab across page reloads", () => {
    saveGuestCheckout("first-order", "first-token");
    saveGuestCheckout("second-order", "second-token");
    expect(readGuestCheckout("first-order")).toBe("first-token");
    expect(readGuestCheckout("second-order")).toBe("second-token");
    expect(localStorage.length).toBe(0);
    clearGuestCheckout("first-order");
    expect(readGuestCheckout("first-order")).toBeUndefined();
    expect(readGuestCheckout("second-order")).toBe("second-token");
  });

  it("retains the current order in memory when tab storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is unavailable");
    });
    saveGuestCheckout("first-order", "first-token");
    expect(readGuestCheckout("first-order")).toBe("first-token");
  });

  it("distinguishes denied checkout credentials from intermittent failures", () => {
    expect(
      isCheckoutAccessError(
        Object.assign(new Error("Access denied"), { code: 40_005 })
      )
    ).toBe(true);
    expect(
      isCheckoutAccessError(
        Object.assign(new Error("Forbidden"), { response: { status: 403 } })
      )
    ).toBe(true);
    expect(
      isCheckoutAccessError(
        Object.assign(new Error("Unavailable"), { response: { status: 503 } })
      )
    ).toBe(false);
  });
});
