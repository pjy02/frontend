// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangePassword from "./change-password";
import ThirdPartyAccounts from "./third-party-accounts";

const mocks = vi.hoisted(() => ({
  password: vi.fn(),
  email: vi.fn(),
  mobile: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  send: vi.fn(),
  warning: vi.fn(),
  user: { auth_methods: [] } as unknown as API.User,
  methods: ["email", "mobile"],
}));
vi.mock("@workspace/ui/services/user/user", () => ({
  putV1PublicUserPassword: mocks.password,
  putV1PublicUserBindEmail: mocks.email,
  putV1PublicUserBindMobile: mocks.mobile,
}));
vi.mock("@/utils/common", () => ({ Logout: mocks.logout }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: mocks.warning },
}));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({
    user: mocks.user,
    getUserInfo: mocks.refresh,
    common: {
      oauth_methods: mocks.methods,
      auth: { mobile: { enable_whitelist: false, whitelist: [] } },
    },
  }),
}));
vi.mock("@/sections/auth/send-code", () => ({
  default: ({ type, params }: { type: string; params: unknown }) => (
    <button onClick={() => mocks.send(type, params)} type="button">
      Send code
    </button>
  ),
}));
vi.mock("@workspace/ui/composed/area-code-select", () => ({
  AreaCodeSelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: { phone: string }) => void;
  }) => (
    <input
      aria-label="Area code"
      onChange={(event) => onChange({ phone: event.target.value })}
      value={value}
    />
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      fallback.replace(
        /\{\{(\w+)\}\}/g,
        (_match, key: string) => values?.[key] || key
      ),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { auth_methods: [] } as unknown as API.User;
  mocks.methods = ["email", "mobile"];
  for (const api of [mocks.password, mocks.email, mocks.mobile])
    api.mockResolvedValue({ data: { data: {} } });
});
afterEach(cleanup);

function bound(type: string, identifier: string) {
  mocks.user = {
    auth_methods: [{ auth_type: type, auth_identifier: identifier }],
  } as API.User;
}
function fill(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });
}
function fillPassword() {
  fill("New Password", "new-password");
  fill("Repeat New Password", "new-password");
}
function submitPassword() {
  fireEvent.submit(document.getElementById("password-form") as HTMLFormElement);
}

describe("password credential compatibility", () => {
  it("requires the old password and uses it for accounts which have a bound address", async () => {
    bound("email", "old@test.com");
    render(<ChangePassword />);
    fillPassword();
    submitPassword();
    await screen.findByText("Enter your current password");
    expect(mocks.password).not.toHaveBeenCalled();
    fill("Current password", "old-password");
    submitPassword();
    await waitFor(() =>
      expect(mocks.password).toHaveBeenCalledWith({
        password: "new-password",
        old_password: "old-password",
        current_code: undefined,
      })
    );
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
  it("supports a phone-only passwordless account without sending a masked phone number", async () => {
    bound("mobile", "138****1234");
    render(<ChangePassword />);
    fillPassword();
    fireEvent.click(screen.getByRole("button", { name: /No password set/ }));
    fill("Current phone number", "13800131234");
    fireEvent.change(screen.getByLabelText("Area code"), {
      target: { value: "86" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(mocks.send).toHaveBeenCalledWith("phone", {
      type: 2,
      telephone: "13800131234",
      telephone_area_code: "86",
    });
    fill("Code sent to 138****1234", "123456");
    submitPassword();
    await waitFor(() =>
      expect(mocks.password).toHaveBeenCalledWith({
        password: "new-password",
        current_code: "123456",
        old_password: undefined,
      })
    );
    expect(mocks.logout).toHaveBeenCalled();
  });
  it("supports email-code verification and does not submit a stale password", async () => {
    bound("email", "old@test.com");
    render(<ChangePassword />);
    fillPassword();
    fill("Current password", "stale-password");
    fireEvent.click(screen.getByRole("button", { name: /No password set/ }));
    fill("Code sent to old@test.com", "123456");
    submitPassword();
    await waitFor(() =>
      expect(mocks.password).toHaveBeenCalledWith({
        password: "new-password",
        current_code: "123456",
        old_password: undefined,
      })
    );
  });
  it("allows OAuth/device-only users to set their first password without an unreachable code", async () => {
    bound("google", "google-id");
    render(<ChangePassword />);
    fillPassword();
    submitPassword();
    await waitFor(() =>
      expect(mocks.password).toHaveBeenCalledWith({
        password: "new-password",
        old_password: undefined,
        current_code: undefined,
      })
    );
  });
  it("preserves fields after failure and displays remaining third-party bindings on success", async () => {
    mocks.password
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        data: { data: { third_party_bindings: ["google", "telegram"] } },
      });
    render(<ChangePassword />);
    fillPassword();
    submitPassword();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Update Password",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    expect(
      (screen.getByPlaceholderText("New Password") as HTMLInputElement).value
    ).toBe("new-password");
    expect(mocks.logout).not.toHaveBeenCalled();
    submitPassword();
    await waitFor(() =>
      expect(mocks.warning).toHaveBeenCalledWith(
        expect.stringContaining("google, telegram"),
        { duration: 20_000 }
      )
    );
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
  it("blocks rapid duplicate submissions while keeping retry available", async () => {
    let reject: (error: Error) => void = vi.fn();
    mocks.password.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      })
    );
    render(<ChangePassword />);
    fillPassword();
    submitPassword();
    submitPassword();
    await waitFor(() => expect(mocks.password).toHaveBeenCalledTimes(1));
    reject(new Error("offline"));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Update Password",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    submitPassword();
    await waitFor(() => expect(mocks.password).toHaveBeenCalledTimes(2));
  });
});

describe("email and mobile binding compatibility", () => {
  it("first email binding needs only the new-address code and keeps the session", async () => {
    mocks.methods = ["email"];
    render(<ThirdPartyAccounts />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fill("Enter your email...", "new@test.com");
    fill("Enter code...", "123456");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mocks.email).toHaveBeenCalledWith({
        email: "new@test.com",
        code: "123456",
        password: undefined,
        current_code: undefined,
      })
    );
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("email replacement verifies the current email and logs out only after success", async () => {
    bound("email", "old@test.com");
    mocks.methods = ["email"];
    render(<ThirdPartyAccounts />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    fill("Enter your email...", "new@test.com");
    fill("Enter code...", "123456");
    fireEvent.click(screen.getByRole("button", { name: /No password set/ }));
    fill("Code sent to old@test.com", "654321");
    mocks.email.mockRejectedValueOnce(new Error("invalid code"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.email).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(
      (screen.getByPlaceholderText("Enter your email...") as HTMLInputElement)
        .value
    ).toBe("new@test.com");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mocks.email).toHaveBeenLastCalledWith({
        email: "new@test.com",
        code: "123456",
        password: undefined,
        current_code: "654321",
      })
    );
    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("first phone binding does not request the current password", async () => {
    mocks.methods = ["mobile"];
    render(<ThirdPartyAccounts />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fill("Enter your telephone...", "13900139000");
    fill("Enter code...", "123456");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mocks.mobile).toHaveBeenCalledWith({
        area_code: "1",
        mobile: "13900139000",
        code: "123456",
        password: undefined,
        current_code: undefined,
      })
    );
    expect(mocks.logout).not.toHaveBeenCalled();
  });
  it("phone replacement supports security codes and keeps helper fields out of the API body", async () => {
    bound("mobile", "138****1234");
    mocks.methods = ["mobile"];
    render(<ThirdPartyAccounts />);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    fill("Enter your telephone...", "13900139000");
    fill("Enter code...", "123456");
    fireEvent.click(screen.getByRole("button", { name: /No password set/ }));
    fill("Current phone number", "13800131234");
    fill("Code sent to 138****1234", "654321");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mocks.mobile).toHaveBeenCalledWith({
        area_code: "1",
        mobile: "13900139000",
        code: "123456",
        password: undefined,
        current_code: "654321",
      })
    );
    expect(mocks.logout).toHaveBeenCalled();
  });
});
