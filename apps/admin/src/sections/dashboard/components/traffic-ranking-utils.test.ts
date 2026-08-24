import { describe, expect, it } from "vitest";
import { getTrafficRankWidth, getUserEmail } from "./traffic-ranking-utils";

describe("traffic ranking utilities", () => {
  it("uses one leader scale for every ranking row", () => {
    expect(getTrafficRankWidth(100, 100)).toBe(100);
    expect(getTrafficRankWidth(60, 100)).toBe(60);
    expect(getTrafficRankWidth(0, 100)).toBe(0);
    expect(getTrafficRankWidth(10, 0)).toBe(0);
  });

  it("extracts the email authentication identifier", () => {
    expect(
      getUserEmail({
        auth_methods: [
          { auth_identifier: "telegram-user", auth_type: "telegram" },
          { auth_identifier: " user@example.com ", auth_type: "email" },
        ],
      })
    ).toBe("user@example.com");
    expect(getUserEmail({ auth_methods: [] })).toBeUndefined();
  });
});
