// @vitest-environment jsdom
import { CanceledError } from "axios";
import { describe, expect, it, vi } from "vitest";
import request, { isAuthenticationError } from "./request";

const feedback = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: feedback }));

describe("request authorization errors", () => {
  it("rejects cancelled reads without an error toast or authentication side effects", async () => {
    const cancelled = new CanceledError("Superseded query");
    await expect(
      request.get("/local-cancel-fixture", {
        adapter: async () => {
          throw cancelled;
        },
      })
    ).rejects.toBe(cancelled);
    expect(feedback.error).not.toHaveBeenCalled();
  });
  it("logs out only when authentication is missing, invalid, or expired", () => {
    expect(isAuthenticationError(40_002)).toBe(true);
    expect(isAuthenticationError(40_003)).toBe(true);
    expect(isAuthenticationError(40_004)).toBe(true);
  });

  it("keeps an authenticated session for permission-denied responses", () => {
    expect(isAuthenticationError(40_005)).toBe(false);
  });
});
