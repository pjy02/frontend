import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@workspace/ui/components/command";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type NavItem, useNavs } from "./navs";

interface SearchItem {
  title: string;
  url: string;
  group: string;
  icon?: NavItem["icon"];
}

function flattenNavs(navs: NavItem[]): SearchItem[] {
  return navs.flatMap((nav) => {
    if (nav.url) {
      return [
        {
          title: nav.title,
          url: nav.url,
          group: nav.title,
          icon: nav.icon,
        },
      ];
    }

    return (nav.items || [])
      .filter((item): item is NavItem & { url: string } => Boolean(item.url))
      .map((item) => ({
        title: item.title,
        url: item.url,
        group: nav.title,
        icon: item.icon,
      }));
  });
}

export function AdminSearch() {
  const { t } = useTranslation("components");
  const navs = useNavs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => flattenNavs(navs), [navs]);
  const groups = useMemo(
    () => Array.from(new Set(items.map((item) => item.group))),
    [items]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const goTo = (url: string) => {
    setOpen(false);
    navigate({ to: url as "/dashboard" });
  };

  return (
    <>
      <Button
        aria-label={t("admin.search.open", "Search admin pages")}
        className="h-10 w-10 shrink-0 justify-start rounded-full border-input bg-muted/70 px-0 text-muted-foreground shadow-none hover:bg-muted sm:w-full sm:max-w-md sm:px-3"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <Search className="size-4 shrink-0 sm:me-1" />
        <span className="hidden min-w-0 flex-1 truncate text-left font-normal sm:block">
          {t("admin.search.placeholder", "Search pages and settings")}
        </span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog
        className="max-w-xl"
        description={t(
          "admin.search.description",
          "Search and open an admin page"
        )}
        onOpenChange={setOpen}
        open={open}
        title={t("admin.search.title", "Admin search")}
      >
        <CommandInput
          placeholder={t(
            "admin.search.inputPlaceholder",
            "Search pages and settings..."
          )}
        />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>
            {t("admin.search.empty", "No matching page found")}
          </CommandEmpty>
          {groups.map((group) => (
            <CommandGroup heading={group} key={group}>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <CommandItem
                      key={item.url}
                      onSelect={() => goTo(item.url)}
                      value={`${group} ${item.title}`}
                    >
                      {ItemIcon ? <ItemIcon className="size-4" /> : null}
                      <span>{item.title}</span>
                      <CommandShortcut>↵</CommandShortcut>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
