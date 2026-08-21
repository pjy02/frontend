import { Outlet } from "@tanstack/react-router";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { getCookie } from "@workspace/ui/lib/cookies";
import { type CSSProperties, useState } from "react";
import { Header } from "@/layout/header";
import { SidebarLeft } from "./sidebar-left";

export default function DashboardLayout() {
  const [open, setOpen] = useState(() => {
    const sidebarState = getCookie("sidebar_state");
    return sidebarState === undefined ? true : sidebarState === "true";
  });

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
      <SidebarLeft />
      <SidebarInset className="admin-main relative flex-grow overflow-hidden">
        <Header />
        <div className="admin-content flex-grow">
          <div className="admin-content__inner">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
