import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Switch } from "@workspace/ui/components/switch";
import { PanelsTopLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DashboardComponentsMenu({
  projectSupportVisible,
  onProjectSupportVisibleChange,
}: {
  projectSupportVisible: boolean;
  onProjectSupportVisibleChange: (visible: boolean) => void;
}) {
  const { t } = useTranslation("dashboard");
  const label = t("components.button", "Dashboard components");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label={label} size="sm" title={label} variant="outline">
          <PanelsTopLeft />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-sm">{label}</h2>
          <p className="text-muted-foreground text-xs">
            {t(
              "components.description",
              "Choose the optional sections shown on this device."
            )}
          </p>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border bg-muted/25 p-3">
          <div className="min-w-0 space-y-1">
            <Label
              className="cursor-pointer"
              htmlFor="dashboard-project-support"
            >
              {t("components.projectSupport", "Project support")}
            </Label>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t(
                "components.projectSupportDescription",
                "Show the current PPanel project supporters."
              )}
            </p>
          </div>
          <Switch
            aria-label={t("components.projectSupport", "Project support")}
            checked={projectSupportVisible}
            className="shrink-0"
            id="dashboard-project-support"
            onCheckedChange={onProjectSupportVisibleChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
