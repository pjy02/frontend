import { describe, expect, it } from "vitest";
import {
  buildBasicInfoUpdate,
  logCleanupSchema,
  MAX_TICKET_CONTENT_LENGTH,
  referralPercentageSchema,
  ticketReplySchema,
} from "./admin-form-contracts";

describe("admin backend form contracts", () => {
  it("leaves legacy retention untouched and rejects saving less than seven days", () => {
    const legacy = { auto_clear: false, clear_days: 3 };
    expect(logCleanupSchema().safeParse(legacy).success).toBe(false);
    expect(legacy.clear_days).toBe(3);
    expect(
      logCleanupSchema().safeParse({ ...legacy, clear_days: 7 }).success
    ).toBe(true);
    expect(
      logCleanupSchema().safeParse({ ...legacy, clear_days: 7.5 }).success
    ).toBe(false);
  });

  it.each([0, 12.5, 100])("accepts referral percentage %s", (value) => {
    expect(referralPercentageSchema().safeParse(value).success).toBe(true);
  });

  it.each([
    -1,
    100.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects invalid referral percentage %s", (value) => {
    expect(referralPercentageSchema().safeParse(value).success).toBe(false);
  });

  it("omits untouched wallet amounts from a profile-only update", () => {
    const wallets = { balance: 10_000, commission: 2000, gift_amount: 300 };
    expect(
      buildBasicInfoUpdate(
        { user_id: 7, avatar: "new.png", ...wallets },
        wallets
      )
    ).toEqual({ user_id: 7, avatar: "new.png" });
  });

  it("sends an explicitly changed wallet amount of zero and omits the others", () => {
    const wallets = { balance: 10_000, commission: 2000, gift_amount: 300 };
    expect(
      buildBasicInfoUpdate({ user_id: 7, ...wallets, balance: 0 }, wallets)
    ).toEqual({ user_id: 7, balance: 0 });
  });

  it("omits a wallet amount after an edit is reverted", () => {
    expect(
      buildBasicInfoUpdate({ user_id: 7, balance: 1000 }, { balance: 1000 })
    ).toEqual({ user_id: 7 });
  });

  it("checks text and attachment reply length and reply types", () => {
    const reply = { ticket_id: 1, from: "System", type: 1, content: "Hello" };
    expect(ticketReplySchema().safeParse(reply).success).toBe(true);
    expect(
      ticketReplySchema().safeParse({ ...reply, content: "  " }).success
    ).toBe(false);
    expect(ticketReplySchema().safeParse({ ...reply, type: 0 }).success).toBe(
      false
    );
    expect(
      ticketReplySchema().safeParse({
        ...reply,
        content: "a".repeat(MAX_TICKET_CONTENT_LENGTH),
      }).success
    ).toBe(true);
    expect(
      ticketReplySchema().safeParse({
        ...reply,
        type: 2,
        content: "a".repeat(MAX_TICKET_CONTENT_LENGTH + 1),
      }).success
    ).toBe(false);
  });
});
