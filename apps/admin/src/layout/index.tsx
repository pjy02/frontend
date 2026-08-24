import { Outlet, useLocation } from "@tanstack/react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { getCookie } from "@workspace/ui/lib/cookies";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "@/layout/header";
import { SidebarLeft } from "./sidebar-left";

export default function DashboardLayout() {
  const { t } = useTranslation("components");
  const pathname = useLocation({ select: (location) => location.pathname });
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const pageTransitionKey = pathname.startsWith("/dashboard/servers/")
    ? "/dashboard/servers"
    : pathname;
  const [open, setOpen] = useState(() => {
    const sidebarState = getCookie("sidebar_state");
    return sidebarState === undefined ? true : sidebarState === "true";
  });

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }
    previousPathname.current = pathname;
    const frame = requestAnimationFrame(() => {
      mainRef.current?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
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
          <div
            className="admin-content__inner admin-page-transition"
            key={pageTransitionKey}
          >
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
