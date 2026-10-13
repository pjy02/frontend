import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearOAuthAttempt,
  startOAuthNonce,
  storeOAuthCfToken,
  storeOAuthInvite,
  takeOAuthCfToken,
  takeOAuthInvite,
  takeOAuthNonce,
} from "./oauth";

function createSessionStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("OAuth nonce lifecycle", () => {
  it("stores and consumes the exact random nonce together with its provider", () => {
    vi.stubGlobal("window", { sessionStorage: createSessionStorage() });
    const nonce = startOAuthNonce("google");
    expect(nonce).toMatch(/^[a-f0-9]{48}$/);
    expect(takeOAuthNonce("google")).toBe(nonce);
    expect(takeOAuthNonce("google")).toBeUndefined();
  });
  it("rejects a different provider and consumes the failed attempt", () => {
    vi.stubGlobal("window", { sessionStorage: createSessionStorage() });
    startOAuthNonce("google");
    expect(() => takeOAuthNonce("apple")).toThrow();
    expect(takeOAuthNonce("google")).toBeUndefined();
  });
  it("expires abandoned attempts and clears all OAuth values on logout", () => {
    vi.stubGlobal("window", { sessionStorage: createSessionStorage() });
    vi.useFakeTimers();
    startOAuthNonce("google");
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(() => takeOAuthNonce("google")).toThrow();
    startOAuthNonce("google");
    storeOAuthCfToken("token");
    storeOAuthInvite("invite");
    clearOAuthAttempt();
    expect(takeOAuthNonce("google")).toBeUndefined();
    expect(takeOAuthCfToken()).toBeUndefined();
    expect(takeOAuthInvite()).toBeUndefined();
  });
});

describe("OAuth Turnstile token persistence", () => {
  it("survives the provider round trip and is consumed once", () => {
    const sessionStorage = createSessionStorage();
    vi.stubGlobal("window", { sessionStorage });

    storeOAuthCfToken("turnstile-token");

    expect(takeOAuthCfToken()).toBe("turnstile-token");
    expect(takeOAuthCfToken()).toBeUndefined();
  });
});

describe("OAuth invitation persistence", () => {
  it("survives the provider round trip and is consumed once", () => {
    const sessionStorage = createSessionStorage();
    vi.stubGlobal("window", { sessionStorage });

    storeOAuthInvite("invite-code");

    expect(takeOAuthInvite()).toBe("invite-code");
    expect(takeOAuthInvite()).toBeUndefined();
  });
});
