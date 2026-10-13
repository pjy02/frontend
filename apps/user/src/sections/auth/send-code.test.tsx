// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SendCode from "./send-code";

const mocks = vi.hoisted(() => ({
  email: vi.fn(),
  sms: vi.fn(),
  cookie: vi.fn(),
  verify: { enable_register_verify: false, turnstile_site_key: "site" },
}));
vi.mock("@workspace/ui/services/common/common", () => ({
  postCommonSendCode: mocks.email,
  postCommonSendSmsCode: mocks.sms,
}));
vi.mock("@workspace/ui/lib/cookies", () => ({ getCookie: mocks.cookie }));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({
    common: { verify_code: { verify_code_interval: 60 }, verify: mocks.verify },
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.verify.enable_register_verify = false;
  mocks.cookie.mockReturnValue(undefined);
  mocks.email.mockResolvedValue({});
  mocks.sms.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("verification code sending", () => {
  it("isolates registration and security countdowns when the same component changes purpose", async () => {
    const { rerender } = render(
      <SendCode params={{ email: "a@test.com", type: 1 }} type="email" />
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toBe("60s")
    );
    rerender(
      <SendCode params={{ email: "a@test.com", type: 2 }} type="email" />
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mocks.email).toHaveBeenCalledTimes(2));
    expect(localStorage.getItem("verify_code_email_1")).not.toBeNull();
    await waitFor(() =>
      expect(localStorage.getItem("verify_code_email_2")).not.toBeNull()
    );
  });
  it.each([
    "email",
    "phone",
  ] as const)("passes Turnstile to anonymous %s registration and consumes the challenge", async (type) => {
    mocks.verify.enable_register_verify = true;
    const used = vi.fn();
    const params = {
      type: 1 as const,
      email: "a@test.com",
      telephone: "1234567890",
      telephone_area_code: "86",
    };
    const { rerender } = render(
      <SendCode onChallengeUsed={used} params={params} type={type} />
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true
    );
    rerender(
      <SendCode
        onChallengeUsed={used}
        params={{ ...params, cf_token: "challenge" }}
        type={type}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(type === "email" ? mocks.email : mocks.sms).toHaveBeenCalledWith(
        expect.objectContaining({ type: 1, cf_token: "challenge" })
      )
    );
    expect(used).toHaveBeenCalledTimes(1);
  });
  it("does not require registration challenge for authenticated binding or security codes", async () => {
    mocks.verify.enable_register_verify = true;
    mocks.cookie.mockReturnValue("session");
    render(<SendCode params={{ email: "a@test.com", type: 1 }} type="email" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(mocks.email).toHaveBeenCalledWith({ email: "a@test.com", type: 1 })
    );
  });
  it("preserves retry capability on failure and blocks rapid duplicate requests", async () => {
    let reject: (error: Error) => void = vi.fn();
    mocks.email.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      })
    );
    render(<SendCode params={{ email: "a@test.com", type: 2 }} type="email" />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.email).toHaveBeenCalledTimes(1);
    reject(new Error("offline"));
    await waitFor(() =>
      expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
        false
      )
    );
    expect(localStorage.getItem("verify_code_email_2")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mocks.email).toHaveBeenCalledTimes(2));
  });
  it("never sends to a masked phone number", () => {
    render(
      <SendCode
        params={{
          telephone: "138****1234",
          telephone_area_code: "86",
          type: 2,
        }}
        type="phone"
      />
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(mocks.sms).not.toHaveBeenCalled();
  });
  it("restores a saved deadline and enables resending after expiry", () => {
    vi.useFakeTimers();
    localStorage.setItem("verify_code_phone_2", String(Date.now() + 2000));
    render(
      <SendCode
        params={{
          telephone: "13800138000",
          telephone_area_code: "86",
          type: 2,
        }}
        type="phone"
      />
    );
    expect(screen.getByRole("button").textContent).toBe("2s");
    act(() => vi.advanceTimersByTime(2000));
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});
