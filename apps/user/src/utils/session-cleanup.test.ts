// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalStore } from "@/stores/global";
import { Logout } from "./common";
import { startOAuthNonce, storeOAuthCfToken, storeOAuthInvite } from "./oauth";

const mocks = vi.hoisted(() => ({
  token: "session" as string | undefined,
  info: vi.fn(),
}));
vi.mock("@workspace/ui/lib/cookies", () => ({
  getCookie: () => mocks.token,
  removeCookie: () => {
    mocks.token = undefined;
  },
  setCookie: (_name: string, token: string) => {
    mocks.token = token;
  },
}));
vi.mock("@workspace/ui/services/user/user", () => ({
  getV1PublicUserInfo: mocks.info,
}));
beforeEach(() => {
  mocks.token = "session";
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("local session cleanup", () => {
  it("clears credentials, user state, loading and all OAuth temporary values", () => {
    useGlobalStore.getState().setUser({ id: 1 } as API.User);
    startOAuthNonce("google");
    storeOAuthCfToken("token");
    storeOAuthInvite("invite");
    Logout();
    expect(mocks.token).toBeUndefined();
    expect(useGlobalStore.getState().user).toBeUndefined();
    expect(useGlobalStore.getState().isLoadingUser).toBe(false);
    expect(sessionStorage.getItem("oauth-nonce")).toBeNull();
    expect(sessionStorage.getItem("oauth-cf-token")).toBeNull();
    expect(sessionStorage.getItem("oauth-invite")).toBeNull();
  });
  it("does not restore the old user from an in-flight info request after logout", async () => {
    let resolve: (value: unknown) => void = vi.fn();
    mocks.info.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolve = resolvePromise;
      })
    );
    const request = useGlobalStore.getState().getUserInfo();
    Logout();
    resolve({ data: { data: { id: 1 } } });
    await request;
    expect(useGlobalStore.getState().user).toBeUndefined();
  });
});
