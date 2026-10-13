import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoutFromServer } from "./logout";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  local: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("@workspace/ui/services/user/user", () => ({
  postV1PublicUserLogout: mocks.request,
}));
vi.mock("@workspace/ui/lib/cookies", () => ({ getCookie: mocks.cookie }));
vi.mock("./common", () => ({ Logout: mocks.local }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockReturnValue("old-session");
  mocks.request.mockResolvedValue({});
});

describe("server logout fallback", () => {
  it("revokes the server session and then logs out locally", async () => {
    await logoutFromServer();
    expect(mocks.request).toHaveBeenCalledWith({
      timeout: 3000,
      skipErrorHandler: true,
    });
    expect(mocks.local).toHaveBeenCalledTimes(1);
  });
  it("still logs out locally when revocation fails", async () => {
    mocks.request.mockRejectedValueOnce(new Error("offline"));
    await logoutFromServer();
    expect(mocks.local).toHaveBeenCalledTimes(1);
  });
  it("deduplicates repeated logout clicks", async () => {
    let resolve: (value: unknown) => void = vi.fn();
    mocks.request.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolve = resolvePromise;
      })
    );
    const first = logoutFromServer();
    expect(logoutFromServer()).toBe(first);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    resolve({});
    await first;
    expect(mocks.local).toHaveBeenCalledTimes(1);
  });
  it("does not clear a newer login while an old logout is pending", async () => {
    mocks.cookie
      .mockReturnValueOnce("old-session")
      .mockReturnValue("new-session");
    await logoutFromServer();
    expect(mocks.local).not.toHaveBeenCalled();
  });
  it("clears local state even if there is no token", async () => {
    mocks.cookie.mockReturnValue(undefined);
    await logoutFromServer();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.local).toHaveBeenCalled();
  });
});
