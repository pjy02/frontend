import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { useTranslation } from "react-i18next";
import { NotFoundState } from "@/components/states";

export function NotFoundPage({ contained = false }: { contained?: boolean }) {
  const { t } = useTranslation("components");

  return (
    <div
      className={
        contained
          ? "grid min-h-[60vh] place-items-center p-4"
          : "grid min-h-svh place-items-center bg-background p-4"
      }
    >
      <div className="w-full max-w-2xl">
        <NotFoundState
          action={
            <Button asChild size="sm">
              <Link to="/dashboard">
                {t("state.backToDashboard", "Back to dashboard")}
              </Link>
            </Button>
          }
          description={t(
            "state.notFoundDescription",
            "The requested page may have moved or no longer exists."
          )}
          title={t("state.notFoundTitle", "Page not found")}
        />
      </div>
    </div>
  );
}
