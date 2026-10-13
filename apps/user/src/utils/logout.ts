import { getCookie } from "@workspace/ui/lib/cookies";
import { postV1PublicUserLogout } from "@workspace/ui/services/user/user";
import { Logout } from "./common";

let pending: Promise<void> | undefined;

/** User-initiated logout revokes the session; expired-session handlers stay local. */
export function logoutFromServer(): Promise<void> {
  if (pending) return pending;
  const token = getCookie("Authorization");
  pending = (async () => {
    try {
      if (token)
        await postV1PublicUserLogout({ timeout: 3000, skipErrorHandler: true });
    } catch {
      // A network error, revoked token or old backend must not prevent logout.
    } finally {
      const current = getCookie("Authorization");
      // Never clear a new login which happened while the old logout was in flight.
      if (!current || current === token) Logout();
    }
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
