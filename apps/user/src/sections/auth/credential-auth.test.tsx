// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmailAuthForm from "./email/auth-form";
import PhoneAuthForm from "./phone/auth-form";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  navigate: vi.fn(),
  authorize: vi.fn(),
  logout: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("@workspace/ui/services/common/common", () => ({
  postAuthLogin: mocks.login,
  postAuthLoginTelephone: mocks.login,
  postAuthRegister: mocks.register,
  postAuthRegisterTelephone: mocks.register,
  postAuthReset: mocks.reset,
  postAuthResetTelephone: mocks.reset,
}));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({ getUserInfo: mocks.refresh }),
}));
vi.mock("@/utils/common", () => ({
  getRedirectUrl: () => "/dashboard",
  setAuthorization: mocks.authorize,
  Logout: mocks.logout,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: mocks.warning },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: { providers: string }) =>
      fallback.replace("{{providers}}", values?.providers || ""),
  }),
}));

function TestForm({
  loading,
  onSubmit,
  onSwitchForm,
}: {
  loading: boolean;
  onSubmit: (params: unknown) => Promise<boolean>;
  onSwitchForm: (mode: string) => void;
}) {
  return (
    <>
      <button
        disabled={loading}
        onClick={() => onSubmit({ password: "new-password", code: "123456" })}
        type="button"
      >
        Submit
      </button>
      <button onClick={() => onSwitchForm("reset")} type="button">
        Reset mode
      </button>
    </>
  );
}
vi.mock("./email/login-form", () => ({ default: TestForm }));
vi.mock("./email/register-form", () => ({ default: TestForm }));
vi.mock("./email/reset-form", () => ({ default: TestForm }));
vi.mock("./phone/login-form", () => ({ default: TestForm }));
vi.mock("./phone/register-form", () => ({ default: TestForm }));
vi.mock("./phone/reset-form", () => ({ default: TestForm }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue(undefined);
  mocks.login.mockResolvedValue({ data: { data: { token: "jwt" } } });
  mocks.reset.mockResolvedValue({
    data: { data: { third_party_bindings: ["google", "telegram"] } },
  });
});
afterEach(cleanup);

describe.each([
  ["email", EmailAuthForm],
  ["phone", PhoneAuthForm],
] as const)("%s authentication credentials", (_channel, Component) => {
  it("shows bindings after reset and clears the invalidated local session", async () => {
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: "Reset mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining("google, telegram"),
      { duration: 20_000 }
    );
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("keeps the reset form usable after a failed request", async () => {
    mocks.reset.mockRejectedValueOnce(new Error("invalid code"));
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: "Reset mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    expect(mocks.logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledTimes(2));
    expect(mocks.logout).toHaveBeenCalled();
  });
  it("keeps login loading until the user has been restored", async () => {
    let resolve: () => void = vi.fn();
    mocks.refresh.mockReturnValueOnce(
      new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
      })
    );
    render(<Component />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(
      (screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();
    resolve();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" })
    );
  });
});
