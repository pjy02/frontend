import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command";
import { useTheme } from "@workspace/ui/integrations/theme";
import { Laptop, Moon, Search, Settings, Shield, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminThemeTransition } from "@/components/theme-transition-provider";
import { type NavItem, useNavs } from "./navs";

interface SearchItem {
  title: string;
  url: string;
  group: string;
  icon?: NavItem["icon"];
}

const SETTING_SHORTCUTS = [
  { id: "site", title: "Site Configuration", url: "/dashboard/system", kind: "system" },
  { id: "currency", title: "Currency Settings", url: "/dashboard/system", kind: "system" },
  { id: "tos", title: "Terms of Service", url: "/dashboard/system", kind: "system" },
  { id: "privacy", title: "Privacy Policy", url: "/dashboard/system", kind: "system" },
  { id: "register", title: "Registration Settings", url: "/dashboard/system", kind: "system" },
  { id: "invite", title: "Invite & Referral", url: "/dashboard/system", kind: "system" },
  { id: "verify", title: "Turnstile Verification", url: "/dashboard/system", kind: "system" },
  { id: "verify-code", title: "Verification Code Rules", url: "/dashboard/system", kind: "system" },
  { id: "log-cleanup", title: "Log Cleanup Policy", url: "/dashboard/system", kind: "system" },
  { id: "email", title: "Email Delivery Settings", url: "/dashboard/auth-control", kind: "auth" },
  { id: "phone", title: "Phone & SMS Settings", url: "/dashboard/auth-control", kind: "auth" },
  { id: "apple", title: "Apple Sign-In", url: "/dashboard/auth-control", kind: "auth" },
  { id: "google", title: "Google Sign-In", url: "/dashboard/auth-control", kind: "auth" },
  { id: "facebook", title: "Facebook Sign-In", url: "/dashboard/auth-control", kind: "auth" },
  { id: "github", title: "GitHub Sign-In", url: "/dashboard/auth-control", kind: "auth" },
  { id: "telegram", title: "Telegram Auth", url: "/dashboard/auth-control", kind: "auth" },
  { id: "device", title: "Device Authentication", url: "/dashboard/auth-control", kind: "auth" },
] as const;

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
  const applyTheme = useAdminThemeTransition();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => flattenNavs(navs), [navs]);
  const groups = useMemo(
    () => Array.from(new Set(items.map((item) => item.group))),
    [items]
  );

  const shortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl K";
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent;
    return /mac/i.test(platform) ? "⌘K" : "Ctrl K";
  }, []);

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

  const goToSetting = (url: string, tab: string) => {
    setOpen(false);
    navigate({ to: url as "/dashboard", search: { tab } as never });
  };

  const switchTheme = (next: "light" | "dark" | "system") => {
    setOpen(false);
    if (applyTheme) {
      applyTheme(next, null);
    } else {
      setTheme(next);
    }
  };

  return (
    <>
      <Button
        aria-label={t("admin.search.open", "Search admin pages")}
        className="h-7 w-7 shrink-0 justify-start rounded-md border-border bg-muted/45 px-0 text-muted-foreground hover:bg-muted/80 sm:w-56 sm:px-2.5 md:w-64"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <Search className="size-3.5 shrink-0 sm:me-1.5" />
        <span className="hidden min-w-0 flex-1 truncate text-left font-normal text-xs sm:block">
          {t("admin.search.placeholder", "Search pages and settings")}
        </span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border/80 bg-card px-1.5 py-0.5 font-medium font-mono text-[10px] text-muted-foreground md:inline-flex">
          {shortcutLabel}
        </kbd>
      </Button>

      <CommandDialog
        className="max-w-xl overflow-hidden border-border shadow-2xl"
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
          <CommandSeparator />
          <CommandGroup heading="Settings">
            {SETTING_SHORTCUTS.map((setting) => {
              const Icon = setting.kind === "system" ? Settings : Shield;
              return (
                <CommandItem
                  key={setting.id}
                  onSelect={() => goToSetting(setting.url, setting.id)}
                  value={`settings ${setting.id} ${setting.title}`}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{setting.title}</span>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem
              onSelect={() => switchTheme("light")}
              value="theme light appearance"
            >
              <Sun className="size-4 text-muted-foreground" />
              <span>Light</span>
            </CommandItem>
            <CommandItem
              onSelect={() => switchTheme("dark")}
              value="theme dark appearance"
            >
              <Moon className="size-4 text-muted-foreground" />
              <span>Dark</span>
            </CommandItem>
            <CommandItem
              onSelect={() => switchTheme("system")}
              value="theme system auto appearance"
            >
              <Laptop className="size-4 text-muted-foreground" />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
