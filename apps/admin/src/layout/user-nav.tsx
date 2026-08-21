import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGlobalStore } from "@/stores/global";
import { Logout } from "@/utils/common";

export function UserNav() {
  const { t } = useTranslation("auth");
  const { user } = useGlobalStore();
  const identifier = user?.auth_methods?.[0]?.auth_identifier || "Admin";

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={identifier}
            className="h-10 gap-2 rounded-full border bg-background px-1.5 shadow-none hover:bg-muted sm:pe-3"
            variant="outline"
          >
            <Avatar className="size-7">
              <AvatarImage alt={user?.avatar ?? ""} src={user?.avatar ?? ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {identifier.toUpperCase().charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate font-medium text-xs sm:inline">
              {identifier}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="font-medium text-sm leading-none">{identifier}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={Logout}>
            <LogOut className="size-4" />
            {t("logout", "Logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
