import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/** Keep a routed form alive through Presence's exit; navigate only afterwards. */
export function useRouteWorkspaceExit(close: () => void | Promise<void>) {
  const router = useRouter();
  const { t } = useTranslation("components");
  const href = router.history.location.href;
  const [closingHref, setClosingHref] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  return {
    open: closingHref !== href,
    onOpenChange: (open: boolean) => {
      pending.current = open ? null : href;
      setClosingHref(open ? null : href);
    },
    onAfterClose: async () => {
      const expected = pending.current;
      pending.current = null;
      // A newer navigation must never be pulled back to this list by an old exit.
      if (!expected || router.history.location.href !== expected) return;
      try {
        await close();
      } catch {
        setClosingHref(null);
        toast.error(
          t("error.unknown", "Unable to close this workspace. Try again.")
        );
      }
    },
  };
}
