import { describe, expect, it } from "vitest";
import { isAuthenticationError } from "./request";

describe("request authorization errors", () => {
  it("logs out only when authentication is missing, invalid, or expired", () => {
    expect(isAuthenticationError(40_002)).toBe(true);
    expect(isAuthenticationError(40_003)).toBe(true);
    expect(isAuthenticationError(40_004)).toBe(true);
  });

  it("keeps an authenticated session for permission-denied responses", () => {
    expect(isAuthenticationError(40_005)).toBe(false);
  });
});
