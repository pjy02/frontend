// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BasicInfoForm } from "./basic-info-form";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refetch: vi.fn() }));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  putUserBasic: mocks.update,
}));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({ common: { currency: { currency_symbol: "$" } } }),
}));
vi.mock("@workspace/ui/composed/upload-image", () => ({
  UploadImage: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const user = {
  id: 7,
  telegram: 0,
  balance: 10_000,
  commission: 2000,
  gift_amount: 300,
  referral_percentage: 10,
  enable: true,
  is_admin: false,
  only_first_purchase: false,
  avatar: "avatar.png",
  refer_code: "OLD",
  referer_id: 0,
} as API.User;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  mocks.update.mockReset().mockResolvedValue({ data: { code: 200 } });
  mocks.refetch.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("user wallet profile update", () => {
  it("refreshes displayed amounts when there are no unsaved edits", () => {
    const view = render(<BasicInfoForm refetch={mocks.refetch} user={user} />);
    view.rerender(
      <BasicInfoForm
        refetch={mocks.refetch}
        user={{ ...user, balance: 20_000 }}
      />
    );
    expect((screen.getByLabelText("Balance") as HTMLInputElement).value).toBe(
      "200"
    );
  });
  it("does not submit untouched wallet values when a background refresh changes the user prop", async () => {
    const view = render(<BasicInfoForm refetch={mocks.refetch} user={user} />);
    fireEvent.change(screen.getByLabelText("Referral Code"), {
      target: { value: "NEW" },
    });
    view.rerender(
      <BasicInfoForm
        refetch={mocks.refetch}
        user={{ ...user, balance: 20_000 }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const body = mocks.update.mock.calls[0]![0];
    expect(body).toMatchObject({ user_id: 7, refer_code: "NEW" });
    for (const field of ["balance", "commission", "gift_amount"]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it("sends a balance deliberately set to zero", async () => {
    render(<BasicInfoForm refetch={mocks.refetch} user={user} />);
    fireEvent.change(screen.getByLabelText("Balance"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0]![0]).toMatchObject({
      user_id: 7,
      balance: 0,
    });
    expect(mocks.update.mock.calls[0]![0]).not.toHaveProperty("commission");
  });

  it("keeps the changed wallet value after a failure and permits retry", async () => {
    mocks.update.mockRejectedValueOnce(new Error("update failed"));
    render(<BasicInfoForm refetch={mocks.refetch} user={user} />);
    fireEvent.change(screen.getByLabelText("Balance"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    expect((screen.getByLabelText("Balance") as HTMLInputElement).value).toBe(
      "50"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update.mock.calls[1]![0]).toMatchObject({ balance: 5000 });
  });
});
