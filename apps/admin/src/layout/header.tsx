import { Link, useLocation } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { LanguageSwitch } from "@workspace/ui/composed/language-switch";
import { ThemeSwitch } from "@workspace/ui/composed/theme-switch";
import { Fragment, useMemo } from "react";
import { AdminSearch } from "./admin-search";
import { findNavByUrl, useNavs } from "./navs";
import TimezoneSwitch from "./timezone-switch";
import { UserNav } from "./user-nav";

export function Header() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navs = useNavs();
  const items = useMemo(() => findNavByUrl(navs, pathname), [navs, pathname]);

  return (
    <header className="admin-header">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-9 rounded-full" />
        <Separator
          className="mx-1 hidden h-5 sm:block"
          orientation="vertical"
        />
        <Breadcrumb className="hidden min-w-0 lg:block">
          <BreadcrumbList className="flex-nowrap">
            {items.map((item, index) => (
              <Fragment key={`${item.title}-${item.url || index}`}>
                {index !== items.length - 1 ? (
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbLink asChild>
                      <Link
                        className="max-w-36 truncate"
                        to={item.url || "/dashboard"}
                      >
                        {item.title}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                ) : (
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="max-w-48 truncate font-medium">
                      {item.title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
                {index < items.length - 1 ? <BreadcrumbSeparator /> : null}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-0 sm:px-2">
        <AdminSearch />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <div className="hidden items-center gap-0.5 lg:flex">
          <LanguageSwitch />
          <TimezoneSwitch />
        </div>
        <ThemeSwitch />
        <Separator
          className="mx-1 hidden h-5 md:block"
          orientation="vertical"
        />
        <UserNav />
      </div>
    </header>
  );
}
