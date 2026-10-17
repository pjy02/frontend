import { type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { LoadingState } from "./states";

/** Cold page translations must never suspend the persistent navigation shell. */
export function AdminRouteContent({ children }: { children: ReactNode }) {
  const { t } = useTranslation("components");
  return (
    <Suspense
      fallback={<LoadingState label={t("loading", "Loading")} rows={6} />}
    >
      {children}
    </Suspense>
  );
}
