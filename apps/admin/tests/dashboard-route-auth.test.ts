import { describe, expect, it } from "vitest";
import { needsAdminLogin } from "../src/routes/dashboard/route";

describe("dashboard route authorization", () => {
  it("redirects visitors without an authorization cookie", () => {
    expect(needsAdminLogin()).toBe(true);
    expect(needsAdminLogin(" ")).toBe(true);
  });

  it("allows the request layer to validate an existing token", () => {
    expect(needsAdminLogin("token")).toBe(false);
  });
});
