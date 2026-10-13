import { z } from "zod";

export function referralPercentageSchema(
  message = "Referral percentage must be between 0 and 100."
) {
  return z.number().min(0, message).max(100, message).optional();
}

export function logCleanupSchema(
  message = "Keep logs for at least 7 whole days."
) {
  return z.object({
    auto_clear: z.boolean(),
    clear_days: z.number().int(message).min(7, message),
  });
}

export const MAX_TICKET_CONTENT_LENGTH = 65_535;

export function ticketReplySchema(
  message = "Enter a message of at most 65535 characters."
) {
  return z.object({
    ticket_id: z.number().int().positive(),
    from: z.string().max(255),
    type: z.union([z.literal(1), z.literal(2)]),
    content: z
      .string()
      .min(1, message)
      .max(MAX_TICKET_CONTENT_LENGTH, message)
      .refine((value) => value.trim().length > 0, message),
  });
}

// The backend treats provided wallet fields as absolute amounts. Omit an
// untouched field even if the wallet changed after this form was opened.
export function buildBasicInfoUpdate(
  values: API.UpdateUserBasiceInfoRequest,
  baseline: Partial<
    Pick<
      API.UpdateUserBasiceInfoRequest,
      "balance" | "commission" | "gift_amount"
    >
  >
): API.UpdateUserBasiceInfoRequest {
  const { balance, commission, gift_amount, ...request } = values;
  const wallets = { balance, commission, gift_amount };
  const result: API.UpdateUserBasiceInfoRequest = { ...request };
  for (const field of ["balance", "commission", "gift_amount"] as const) {
    const value = wallets[field];
    if (value !== undefined && value !== baseline[field]) {
      result[field] = value;
    }
  }
  return result;
}
