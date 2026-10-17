import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { type Theme, useTheme } from "@workspace/ui/integrations/theme";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export function ThemeSwitch({
  onThemeSelect,
}: {
  onThemeSelect?: (theme: Theme, trigger: HTMLButtonElement | null) => void;
} = {}) {
  const { t } = useTranslation("components");
  const { theme, setTheme } = useTheme();
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<Theme | null>(null);
  const select = (next: Theme) => {
    if (onThemeSelect) pending.current = next;
    else setTheme(next);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-haspopup="menu"
          className="scale-95 rounded-full"
          ref={trigger}
          size="icon"
          title={t("theme.toggle", "Toggle theme")}
          variant="ghost"
        >
          <Sun className="dark:-rotate-90 size-[1.2rem] rotate-0 scale-100 transition-all dark:scale-0" />
          <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t("theme.toggle", "Toggle theme")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={
          onThemeSelect
            ? (event) => {
                const next = pending.current;
                pending.current = null;
                if (!next) return;
                // FocusScope closes after Presence's exit, so the menu is not captured.
                event.preventDefault();
                trigger.current?.focus({ preventScroll: true });
                onThemeSelect(next, trigger.current);
              }
            : undefined
        }
      >
        <DropdownMenuItem onSelect={() => select("light")}>
          {t("theme.light", "Light")}{" "}
          <Check
            className={cn("ms-auto", theme !== "light" && "hidden")}
            size={14}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => select("dark")}>
          {t("theme.dark", "Dark")}
          <Check
            className={cn("ms-auto", theme !== "dark" && "hidden")}
            size={14}
          />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => select("system")}>
          {t("theme.system", "System")}
          <Check
            className={cn("ms-auto", theme !== "system" && "hidden")}
            size={14}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
