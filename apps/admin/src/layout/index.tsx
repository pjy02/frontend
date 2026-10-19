import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { TablePreferencesProvider } from "@workspace/ui/composed/pro-table/view-preferences";
import { getCookie } from "@workspace/ui/lib/cookies";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPageTransition } from "@/components/page-transition";
import { AdminRouteContent } from "@/components/route-content";
import { Header } from "@/layout/header";
import { useGlobalStore } from "@/stores/global";
import { SidebarLeft } from "./sidebar-left";

export default function DashboardLayout() {
  const { t } = useTranslation("components");
  // Navigation intent may precede lazy code. Key motion/preferences by the
  // actually rendered match, not by an URL whose content is still preparing.
  const pathname = useRouterState({
    select: (state) =>
      state.matches.at(-1)?.pathname ?? state.location.pathname,
  });
  const router = useRouter();
  const historyReturn = useRef(false);
  useEffect(
    () =>
      router.history.subscribe(({ action }) => {
        historyReturn.current = ["BACK", "FORWARD", "GO"].includes(action.type);
      }),
    [router]
  );
  const accountId = useGlobalStore((state) => state.user?.id);
  const mainRef = useRef<HTMLElement>(null);
  const routeWorkspaceRoot = ["/dashboard/servers", "/dashboard/product"].find(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
  const pageTransitionKey = routeWorkspaceRoot ?? pathname;
  const previousPage = useRef(pageTransitionKey);
  const [open, setOpen] = useState(() => {
    const sidebarState = getCookie("sidebar_state");
    return sidebarState === undefined ? true : sidebarState === "true";
  });

  const handleContentReady = () => {
    if (previousPage.current === pageTransitionKey) {
      return;
    }
    previousPage.current = pageTransitionKey;
    // History restoration and a route-owned workspace keep their own focus/scroll.
    if (
      historyReturn.current ||
      document.querySelector('[role="dialog"][data-state="open"]')
    )
      return;
    mainRef.current?.focus({
      preventScroll: true,
    });
  };

  return (
    <TablePreferencesProvider
      value={{
        accountKey: accountId === undefined ? null : String(accountId),
        pageKey: pathname,
      }}
    >
      <SidebarProvider
        className="admin-shell"
        onOpenChange={setOpen}
        open={open}
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "4.25rem",
          } as CSSProperties
        }
      >
        <button
          className="admin-skip-link"
          onClick={() => mainRef.current?.focus({ preventScroll: true })}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }
            event.preventDefault();
            mainRef.current?.focus({ preventScroll: true });
          }}
          type="button"
        >
          {t("accessibility.skipToContent", "Skip to main content")}
        </button>
        <SidebarLeft />
        <SidebarInset className="admin-main relative flex-grow overflow-hidden">
          <Header />
          <main
            className="admin-content flex-grow outline-none"
            id="admin-main-content"
            ref={mainRef}
            tabIndex={-1}
          >
            <AdminPageTransition
              onReady={handleContentReady}
              skip={historyReturn.current}
              transitionKey={pageTransitionKey}
              waitForContent
            >
              <AdminRouteContent>
                <Outlet />
              </AdminRouteContent>
            </AdminPageTransition>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TablePreferencesProvider>
  );
}
