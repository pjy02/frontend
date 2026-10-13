const OAUTH_CF_TOKEN_KEY = "oauth-cf-token";
const OAUTH_INVITE_KEY = "oauth-invite";
const OAUTH_NONCE_KEY = "oauth-nonce";

export function clearOAuthAttempt(): void {
  if (typeof window === "undefined") return;
  for (const key of [OAUTH_CF_TOKEN_KEY, OAUTH_INVITE_KEY, OAUTH_NONCE_KEY]) {
    window.sessionStorage.removeItem(key);
  }
}

export function startOAuthNonce(method: string): string {
  clearOAuthAttempt();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  window.sessionStorage.setItem(
    OAUTH_NONCE_KEY,
    JSON.stringify({ method, nonce, createdAt: Date.now() })
  );
  return nonce;
}

export function takeOAuthNonce(method: string): string | undefined {
  const stored = window.sessionStorage.getItem(OAUTH_NONCE_KEY);
  window.sessionStorage.removeItem(OAUTH_NONCE_KEY);
  // Sign-ins started without a nonce must also exchange without one.
  if (!stored) return;
  const attempt = JSON.parse(stored);
  if (
    attempt.method !== method ||
    typeof attempt.nonce !== "string" ||
    attempt.nonce.length < 16 ||
    typeof attempt.createdAt !== "number" ||
    Date.now() - attempt.createdAt > 15 * 60 * 1000
  ) {
    throw new Error("Invalid or expired OAuth attempt");
  }
  return attempt.nonce;
}

export function storeOAuthCfToken(token?: string): void {
  if (typeof window === "undefined") return;

  if (token) {
    window.sessionStorage.setItem(OAUTH_CF_TOKEN_KEY, token);
    return;
  }
  window.sessionStorage.removeItem(OAUTH_CF_TOKEN_KEY);
}

export function takeOAuthCfToken(): string | undefined {
  if (typeof window === "undefined") return;

  const token = window.sessionStorage.getItem(OAUTH_CF_TOKEN_KEY) || undefined;
  window.sessionStorage.removeItem(OAUTH_CF_TOKEN_KEY);
  return token;
}

export function storeOAuthInvite(invite?: string): void {
  if (typeof window === "undefined") return;

  if (invite) {
    window.sessionStorage.setItem(OAUTH_INVITE_KEY, invite);
    return;
  }
  window.sessionStorage.removeItem(OAUTH_INVITE_KEY);
}

export function takeOAuthInvite(): string | undefined {
  if (typeof window === "undefined") return;

  const invite = window.sessionStorage.getItem(OAUTH_INVITE_KEY) || undefined;
  window.sessionStorage.removeItem(OAUTH_INVITE_KEY);
  return invite;
}
