import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  type NotFoundRouteProps,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Button } from "@workspace/ui/components/button";
import { Toaster } from "@workspace/ui/components/sonner";
import { NavigationProgress } from "@workspace/ui/composed/navigation-progress";
import { TanStackQueryDevtools } from "@workspace/ui/integrations/tanstack-query-devtools";
import { getCookie } from "@workspace/ui/lib/cookies";
import { isBrowser } from "@workspace/ui/utils/index";
import type React from "react";
import { useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  ErrorState,
  LoadingState,
  NotFoundState,
  PermissionDeniedState,
} from "@/components/states";
import { useGlobalStore } from "@/stores/global";
import { fetchInitialConfig } from "@/utils/bootstrap";

function StatePage({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <div className="w-full max-w-2xl">{children}</div>
    </main>
  );
}

function getErrorCode(error: unknown) {
  const candidate = error as {
    code?: number;
    status?: number;
    response?: { status?: number; data?: { code?: number } };
  };
  return (
    candidate?.response?.data?.code ??
    candidate?.response?.status ??
    candidate?.status ??
    candidate?.code
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation("components");
  const code = getErrorCode(error);
  const forbidden = code === 403 || code === 40_005;

  return (
    <StatePage>
      {forbidden ? (
        <PermissionDeniedState
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard">
                {t("state.backToDashboard", "Back to dashboard")}
              </Link>
            </Button>
          }
          description={t(
            "state.permissionDescription",
            "Your account does not have permission to open this page. Contact an administrator if you think this is a mistake."
          )}
          title={t("state.permissionTitle", "Access restricted")}
        />
      ) : (
        <ErrorState
          description={t(
            "state.errorDescription",
            "The page could not be loaded. Check your connection and try again."
          )}
          onRetry={reset}
          retryLabel={t("state.retry", "Try again")}
          title={t("state.errorTitle", "Something went wrong")}
        />
      )}
    </StatePage>
  );
}

function RootPending() {
  const { t } = useTranslation("components");
  return (
    <StatePage>
      <LoadingState label={t("state.loading", "Loading page")} rows={6} />
    </StatePage>
  );
}

function RootNotFound(_props: NotFoundRouteProps) {
  const { t } = useTranslation("components");
  return (
    <StatePage>
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
    </StatePage>
  );
}

export const Route = createRootRouteWithContext()({
  component: () => {
    const { common, setCommon, getUserInfo } = useGlobalStore();
    useEffect(() => {
      const initializeApp = async () => {
        try {
          const configResponse = await fetchInitialConfig();
          if (configResponse.data?.data) {
            setCommon(configResponse.data.data);
          }
          try {
            if (getCookie("Authorization")) {
              await getUserInfo();
            }
          } catch {
            /* empty */
          }
        } catch (error) {
          console.error("Failed to initialize app:", error);
        }
      };

      initializeApp();
    }, []);

    const { site } = common;
    const title = site.site_name || "Loading...";
    const description = site.site_desc || "";
    const keywords = site.keywords || "";
    const logo = site.site_logo || "";
    const url = isBrowser() ? window.location.href : "";

    return (
      <HelmetProvider>
        <Helmet>
          <title>{title}</title>
          <meta content={description} name="description" />
          <meta content={keywords} name="keywords" />
          <link href={url} rel="canonical" />
          <link href={logo} rel="icon" />
          <link href={logo} rel="apple-touch-icon" sizes="180x180" />
          <link href="/site.webmanifest" rel="manifest" />
        </Helmet>
        <NavigationProgress />
        <Outlet />
        <Toaster closeButton richColors />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
      </HelmetProvider>
    );
  },
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
  pendingComponent: RootPending,
});
