import { Link, useLocation } from "@tanstack/react-router";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { LanguageSwitch } from "@workspace/ui/composed/language-switch";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { useGlobalStore } from "@/stores/global";
import packageJson from "../../../../package.json";
import { type NavItem, useNavs } from "./navs";
import TimezoneSwitch from "./timezone-switch";

function hasChildren(item: NavItem): item is NavItem & { items: NavItem[] } {
  return Boolean(item.items?.length);
}

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { common } = useGlobalStore();
  const { site } = common;
  const navs = useNavs();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { state, isMobile, setOpenMobile } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const normalize = (path: string) =>
    path.endsWith("/") && path !== "/" ? path.replace(/\/+$/, "") : path;

  const isActiveUrl = (url: string) => {
    const currentPath = normalize(pathname);
    const target = normalize(url);
    if (target === "/dashboard") return currentPath === target;
    return currentPath === target || currentPath.startsWith(`${target}/`);
  };

  const isGroupActive = (nav: NavItem) =>
    hasChildren(nav)
      ? nav.items.some((item) => item.url && isActiveUrl(item.url))
      : Boolean(nav.url && isActiveUrl(nav.url));

  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  React.useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const nav of navs) {
        if (!hasChildren(nav)) continue;
        if (isGroupActive(nav)) {
          next[nav.title] = true;
        } else if (next[nav.title] === undefined) {
          next[nav.title] = nav.defaultOpen ?? true;
        }
      }
      return next;
    });
  }, [pathname, navs]);

  const renderCollapsedItem = (nav: NavItem) => {
    const NavIcon = nav.icon;

    if (!hasChildren(nav) && nav.url) {
      return (
        <SidebarMenuButton
          asChild
          className="mx-auto size-10 justify-center rounded-lg"
          isActive={isActiveUrl(nav.url)}
          tooltip={nav.title}
        >
          <Link onClick={handleNavigate} to={nav.url}>
            {NavIcon ? <NavIcon className="size-[18px]" /> : null}
            <span className="sr-only">{nav.title}</span>
          </Link>
        </SidebarMenuButton>
      );
    }

    return (
      <HoverCard closeDelay={160} openDelay={80}>
        <HoverCardTrigger asChild>
          <SidebarMenuButton
            aria-label={nav.title}
            className="mx-auto size-10 justify-center rounded-lg"
            isActive={isGroupActive(nav)}
          >
            {NavIcon ? <NavIcon className="size-[18px]" /> : null}
            <span className="sr-only">{nav.title}</span>
          </SidebarMenuButton>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="z-[60] w-64 overflow-hidden p-0"
          collisionPadding={8}
          side="right"
          sideOffset={10}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            {NavIcon ? (
              <NavIcon className="size-4 text-muted-foreground" />
            ) : null}
            <span className="truncate font-semibold text-sm">{nav.title}</span>
          </div>
          <div className="p-1.5">
            {nav.items?.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                    item.url && isActiveUrl(item.url)
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                  key={item.title}
                  onClick={handleNavigate}
                  to={item.url || "/dashboard"}
                >
                  {ItemIcon ? (
                    <ItemIcon className="size-4 text-muted-foreground" />
                  ) : null}
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <Sidebar className="admin-sidebar" collapsible="icon" {...props}>
      <SidebarHeader className="border-sidebar-border border-b px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-11 rounded-lg px-2 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1!"
              size="lg"
              tooltip={site.site_name || "PPanel"}
            >
              <Link onClick={handleNavigate} to="/dashboard">
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white ring-1 ring-sidebar-border dark:bg-white/10">
                  <img
                    alt=""
                    className="size-7 object-contain"
                    height={28}
                    src={site.site_logo || "/favicon.svg"}
                    width={28}
                  />
                </div>
                <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                  <div className="truncate font-semibold text-[13px]">
                    {site.site_name || "PPanel"}
                  </div>
                  <div className="mt-0.5 truncate text-sidebar-foreground/60 text-xs">
                    {site.site_desc || "Admin Console"}
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {!isMobile && state === "collapsed"
            ? navs.map((nav) => (
                <SidebarMenuItem className="py-0.5" key={nav.title}>
                  {renderCollapsedItem(nav)}
                </SidebarMenuItem>
              ))
            : navs.map((nav) => {
                const NavIcon = nav.icon;

                if (!hasChildren(nav)) {
                  return (
                    <SidebarMenuItem className="mb-1" key={nav.title}>
                      <SidebarMenuButton
                        asChild={Boolean(nav.url)}
                        className="relative h-10 rounded-lg px-3"
                        isActive={isGroupActive(nav)}
                        tooltip={nav.title}
                      >
                        {nav.url ? (
                          <Link onClick={handleNavigate} to={nav.url}>
                            {NavIcon ? (
                              <NavIcon className="size-[18px]" />
                            ) : null}
                            <span>{nav.title}</span>
                          </Link>
                        ) : (
                          <>
                            {NavIcon ? (
                              <NavIcon className="size-[18px]" />
                            ) : null}
                            <span>{nav.title}</span>
                          </>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                const isOpen = openGroups[nav.title] ?? false;
                return (
                  <SidebarGroup className="p-0 pb-1" key={nav.title}>
                    <SidebarMenuButton
                      aria-expanded={isOpen}
                      className="relative h-10 rounded-lg px-3"
                      isActive={isGroupActive(nav)}
                      onClick={() =>
                        setOpenGroups((current) => ({
                          ...current,
                          [nav.title]: !isOpen,
                        }))
                      }
                    >
                      {NavIcon ? <NavIcon className="size-[18px]" /> : null}
                      <span className="min-w-0 flex-1 truncate">
                        {nav.title}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-sidebar-foreground/60 transition-transform duration-200",
                          !isOpen && "-rotate-90"
                        )}
                      />
                    </SidebarMenuButton>
                    {isOpen ? (
                      <SidebarGroupContent>
                        <SidebarMenuSub className="my-1 border-sidebar-border/70">
                          {nav.items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <SidebarMenuSubItem key={item.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  className="relative h-9 rounded-lg"
                                  isActive={Boolean(
                                    item.url && isActiveUrl(item.url)
                                  )}
                                >
                                  <Link
                                    onClick={handleNavigate}
                                    to={item.url || "/dashboard"}
                                  >
                                    {ItemIcon ? (
                                      <ItemIcon className="size-4" />
                                    ) : null}
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </SidebarGroupContent>
                    ) : null}
                  </SidebarGroup>
                );
              })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t px-3 py-3">
        {isMobile ? (
          <div className="mb-2 flex items-center gap-1 border-sidebar-border border-b pb-2">
            <LanguageSwitch />
            <TimezoneSwitch />
          </div>
        ) : null}
        <div className="flex items-center gap-2 px-2 text-sidebar-foreground/60 text-xs group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            PPanel Console · v{packageJson.version}
          </span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
