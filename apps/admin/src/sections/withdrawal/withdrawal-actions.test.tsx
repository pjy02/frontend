// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewActions } from ".";

const mocks = vi.hoisted(() => ({
  onReviewed: vi.fn(),
  putWithdrawalStatus: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@workspace/ui/services/admin/admin", () => ({
  getWithdrawalList: vi.fn(),
  putWithdrawalStatus: mocks.putWithdrawalStatus,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const withdrawal = {
  amount: 1250,
  content: "Alipay account",
  created_at: 1_700_000_000,
  id: 17,
  reason: "",
  status: 0,
  updated_at: 1_700_000_000,
  user_id: 8,
} as API.WithdrawalLog;

beforeEach(() => {
  mocks.putWithdrawalStatus.mockResolvedValue({ data: { data: true } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("commission withdrawal review actions", () => {
  it("confirms approval and refreshes the table", async () => {
    render(
      <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mocks.putWithdrawalStatus).toHaveBeenCalledWith({
        id: 17,
        status: 1,
      });
      expect(mocks.onReviewed).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Withdrawal approved");
  });

  it("requires and submits a rejection reason", async () => {
    render(
      <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const confirm = screen.getByRole("button", { name: "Confirm Reject" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Rejection Reason"), {
      target: { value: "  Account details do not match  " },
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.putWithdrawalStatus).toHaveBeenCalledWith({
        id: 17,
        reason: "Account details do not match",
        status: 2,
      });
      expect(mocks.onReviewed).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Withdrawal rejected");
  });
});
