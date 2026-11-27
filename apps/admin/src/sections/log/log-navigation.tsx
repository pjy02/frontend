"use client";

import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronDown, ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";

const logGroups = [
  {
    key: "account",
    routes: [
      { key: "adminAction", url: "/dashboard/log/admin" },
      { key: "login", url: "/dashboard/log/login" },
      { key: "register", url: "/dashboard/log/register" },
      { key: "subscribe", url: "/dashboard/log/subscribe" },
      { key: "resetSubscribe", url: "/dashboard/log/reset-subscribe" },
    ],
  },
  {
    key: "communication",
    routes: [
      { key: "email", url: "/dashboard/log/email" },
      { key: "mobile", url: "/dashboard/log/mobile" },
    ],
  },
  {
    key: "traffic",
    routes: [
      { key: "serverTraffic", url: "/dashboard/log/server-traffic" },
      { key: "subscribeTraffic", url: "/dashboard/log/subscribe-traffic" },
      { key: "trafficDetails", url: "/dashboard/log/traffic-details" },
    ],
  },
  {
    key: "finance",
    routes: [
      { key: "unmatchedPayment", url: "/dashboard/log/payment-unmatched" },
      { key: "order", url: "/dashboard/log/order" },
      { key: "balance", url: "/dashboard/log/balance" },
      { key: "commission", url: "/dashboard/log/commission" },
      { key: "gift", url: "/dashboard/log/gift" },
    ],
  },
] as const;

export function LogNavigation() {
  const { t } = useTranslation("log");
  const pathname = useLocation({ select: (location) => location.pathname });
  const search = useSearch({ strict: false });

  return (
    <div className="admin-log-nav flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ListFilter className="size-3.5 shrink-0" />
        <span className="font-medium text-foreground text-xs">
          {t("navigation.title", "Log explorer")}
        </span>
        <span className="hidden text-muted-foreground text-xs xl:inline">
          ·{" "}
          {t(
            "navigation.description",
            "Switch log sources without leaving the current investigation."
          )}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {logGroups.map((group) => {
          const activeRoute = group.routes.find(
            (route) => route.url === pathname
          );
          const groupLabel = t(`navigation.group.${group.key}`, group.key);

          return (
            <DropdownMenu key={group.key}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="admin-log-nav__trigger h-7 gap-1.5 rounded-md px-2.5 font-medium text-xs"
                  data-active={activeRoute ? "true" : undefined}
                  size="sm"
                  variant={activeRoute ? "secondary" : "outline"}
                >
                  {activeRoute && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-primary"
                    />
                  )}
                  <span>
                    {activeRoute
                      ? `${groupLabel} · ${t(`navigation.item.${activeRoute.key}`, activeRoute.key)}`
                      : groupLabel}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
                {group.routes.map((route) => {
                  const isActive = route.url === pathname;
                  return (
                    <DropdownMenuItem asChild key={route.key}>
                      <Link
                        className={cn(
                          "flex items-center justify-between",
                          isActive &&
                            "bg-accent font-medium text-accent-foreground"
                        )}
                        search={{ ...search, page: undefined }}
                        to={route.url}
                      >
                        <span>
                          {t(`navigation.item.${route.key}`, route.key)}
                        </span>
                        {isActive && <Check className="size-4 text-primary" />}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </div>
  );
}
