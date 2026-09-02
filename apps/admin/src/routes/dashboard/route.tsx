import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCookie } from "@workspace/ui/lib/cookies";
import { setRedirectUrl } from "@/utils/common";

export function needsAdminLogin(authorization?: string) {
  return !authorization?.trim();
}

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ location }) => {
    if (!needsAdminLogin(getCookie("Authorization"))) return;

    setRedirectUrl(location.href);
    throw redirect({ to: "/" });
  },
});
