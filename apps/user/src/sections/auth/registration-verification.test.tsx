// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmailRegister from "./email/register-form";
import EmailReset from "./email/reset-form";
import PhoneRegister from "./phone/register-form";
import PhoneReset from "./phone/reset-form";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  reset: vi.fn(),
  sendParams: {} as Record<string, unknown>,
  emailVerification: true,
}));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({
    common: {
      verify: {
        enable_register_verify: true,
        enable_reset_password_verify: false,
        turnstile_site_key: "site",
      },
      auth: {
        register: { stop_register: false },
        email: {
          enable_verify: mocks.emailVerification,
          enable_domain_suffix: false,
        },
        mobile: { enable_whitelist: false, whitelist: [] },
      },
      invite: { forced_invite: false },
    },
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("@workspace/ui/composed/area-code-select", () => ({
  AreaCodeSelect: () => <span>Area code</span>,
}));
vi.mock("../auth/send-code", () => ({
  default: ({
    params,
    onChallengeUsed,
  }: {
    params: Record<string, unknown>;
    onChallengeUsed?: () => void;
  }) => (
    <button
      onClick={() => {
        mocks.sendParams = params;
        onChallengeUsed?.();
      }}
      type="button"
    >
      Send code
    </button>
  ),
}));
vi.mock("../auth/turnstile", () => ({
  default: ({
    onChange,
    ref,
  }: {
    onChange: (token: string) => void;
    ref: { current: unknown };
  }) => {
    ref.current = { reset: mocks.reset };
    return (
      <button onClick={() => onChange("fresh-challenge")} type="button">
        Solve challenge
      </button>
    );
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.emailVerification = true;
  mocks.submit.mockResolvedValue(false);
});
afterEach(cleanup);

describe.each([
  ["email", EmailRegister],
  ["phone", PhoneRegister],
] as const)("%s registration verification", (channel, Component) => {
  it("forwards the challenge to code sending and requires a fresh challenge for registration", async () => {
    render(
      <Component
        initialValues={{
          email: "a@test.com",
          telephone: "13800138000",
          password: "password",
          repeat_password: "password",
          code: "123456",
          cf_token: "",
        }}
        loading={false}
        onSubmit={mocks.submit}
        onSwitchForm={vi.fn()}
        setInitialValues={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(mocks.sendParams).toMatchObject({
      cf_token: "fresh-challenge",
      type: 1,
    });
    if (channel === "phone")
      expect(mocks.sendParams).toMatchObject({
        telephone: "13800138000",
        telephone_area_code: "1",
      });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalled());
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.reset.mock.calls.length).toBeGreaterThan(1)
    );
    expect(
      (
        screen.getByPlaceholderText(
          "Enter your password..."
        ) as HTMLInputElement
      ).value
    ).toBe("password");
    expect(
      (screen.getByPlaceholderText("Enter code...") as HTMLInputElement).value
    ).toBe("123456");
  });
});

describe.each([
  ["email", EmailReset],
  ["phone", PhoneReset],
] as const)("%s reset verification", (_channel, Component) => {
  it("always requires the security code and preserves input on failure", async () => {
    mocks.emailVerification = false;
    render(
      <Component
        initialValues={{
          email: "a@test.com",
          telephone: "13800138000",
          telephone_area_code: "86",
          password: "password",
          code: "",
        }}
        onSubmit={mocks.submit}
        onSwitchForm={vi.fn()}
        setInitialValues={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
    await waitFor(() =>
      expect(screen.getAllByText("Enter code...").length).toBeGreaterThan(0)
    );
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Enter code..."), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(
      (
        screen.getByPlaceholderText(
          "Enter your new password..."
        ) as HTMLInputElement
      ).value
    ).toBe("password");
    expect(
      (screen.getByPlaceholderText("Enter code...") as HTMLInputElement).value
    ).toBe("123456");
  });
});
