import { Outlet, useLocation } from "@tanstack/react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { TablePreferencesProvider } from "@workspace/ui/composed/pro-table/view-preferences";
import { getCookie } from "@workspace/ui/lib/cookies";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPageTransition } from "@/components/page-transition";
import { Header } from "@/layout/header";
import { useGlobalStore } from "@/stores/global";
import { SidebarLeft } from "./sidebar-left";

export default function DashboardLayout() {
  const { t } = useTranslation("components");
  const pathname = useLocation({ select: (location) => location.pathname });
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

  useEffect(() => {
    if (previousPage.current === pageTransitionKey) {
      return;
    }
    previousPage.current = pageTransitionKey;
    const frame = requestAnimationFrame(() => {
      // A route-owned workspace manages its own focus; do not steal it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      mainRef.current?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pageTransitionKey]);

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
            <AdminPageTransition transitionKey={pageTransitionKey}>
              <Outlet />
            </AdminPageTransition>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TablePreferencesProvider>
  );
}
