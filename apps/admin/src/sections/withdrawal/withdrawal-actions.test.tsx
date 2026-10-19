// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "@/components/motion-provider";
import { ReviewActions } from ".";

function mount(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MotionProvider>{children}</MotionProvider>
    </QueryClientProvider>
  );
}

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
  mocks.onReviewed.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("commission withdrawal review actions", () => {
  it("shares pending and acknowledged review states across two views, including a slow read retry", async () => {
    let finishWrite: (() => void) | undefined;
    let finishRead: (() => void) | undefined;
    mocks.putWithdrawalStatus.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    mocks.onReviewed
      .mockRejectedValueOnce(new Error("read failed"))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishRead = resolve;
          })
      );
    mount(
      <>
        <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
        <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
      </>
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    fireEvent.click(
      screen.getByRole("alertdialog").querySelector(".admin-confirm-action")!
    );
    await waitFor(() =>
      expect(mocks.putWithdrawalStatus).toHaveBeenCalledTimes(1)
    );
    await act(async () => finishWrite?.());
    await screen.findAllByRole("button", { name: "Retry refresh" });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Retry refresh" })[0]!
    );
    await waitFor(() => expect(mocks.onReviewed).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Reviewing..." }).length).toBe(
      2
    );
    await act(async () => finishRead?.());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mocks.putWithdrawalStatus).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });
  it("keeps failed approval open, never reports success and allows retry", async () => {
    mocks.putWithdrawalStatus.mockRejectedValueOnce(new Error("write failed"));
    mount(
      <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.queryByText("Completed")).toBeNull();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.onReviewed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocks.onReviewed).toHaveBeenCalledTimes(1));
    expect(mocks.putWithdrawalStatus).toHaveBeenCalledTimes(2);
  });

  it("keeps the rejection reason on failure", async () => {
    mocks.putWithdrawalStatus.mockRejectedValueOnce(new Error("write failed"));
    mount(
      <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.change(screen.getByLabelText("Rejection Reason"), {
      target: { value: "Keep this reason" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reject" }));
    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText("Rejection Reason") as HTMLTextAreaElement).value
    ).toBe("Keep this reason");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.onReviewed).not.toHaveBeenCalled();
  });

  it("does not repeat an acknowledged review when its refresh fails", async () => {
    mocks.onReviewed.mockRejectedValueOnce(new Error("read failed"));
    mount(
      <ReviewActions onReviewed={mocks.onReviewed} withdrawal={withdrawal} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByRole("button", { name: "Retry refresh" });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mocks.putWithdrawalStatus).toHaveBeenCalledTimes(1);
    expect(mocks.onReviewed).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("confirms approval and refreshes the table", async () => {
    mount(
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
    mount(
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
