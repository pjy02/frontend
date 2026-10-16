import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ArrowDown, ArrowUp, PanelsTopLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  WorkspaceDialog,
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";
import {
  type DashboardLayout,
  type DashboardModuleId,
  type DashboardPreferences,
  dashboardPreset,
  moveDashboardModule,
} from "./dashboard-preferences";

export const MODULE_LABELS: Record<DashboardModuleId, string> = {
  income: "Income",
  newUsers: "New users",
  onlineUsers: "Online users",
  monthTraffic: "Month traffic",
  trafficRanking: "Traffic ranking",
  revenueTrend: "Revenue trend",
  userTrend: "New user trend",
  systemHealth: "System health",
  servers: "Nodes and servers",
  pending: "Pending tasks",
  systemServices: "System services",
  systemOperations: "System operations",
  projectSupport: "Project support",
};

export function DashboardComponentsMenu({
  preferences,
  device,
  updateLayout,
  unavailable,
  ready,
}: {
  preferences: DashboardPreferences;
  device: keyof DashboardPreferences;
  updateLayout: (
    target: keyof DashboardPreferences,
    update: (layout: DashboardLayout) => DashboardLayout
  ) => void;
  unavailable: boolean;
  ready: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const [target, setTarget] = useState(device);
  const layout = preferences[target];
  const label = t("components.button", "Dashboard components");
  return (
    <WorkspaceDialog
      onOpenChange={(open) => {
        if (open) setTarget(device);
      }}
    >
      <WorkspaceDialogTrigger asChild>
        <Button
          aria-label={label}
          disabled={!ready}
          size="sm"
          title={label}
          variant="outline"
        >
          <PanelsTopLeft />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </WorkspaceDialogTrigger>
      <WorkspaceDialogContent size="md">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>{label}</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>
            {t(
              "components.localHint",
              "Settings are saved for this administrator in this browser. Phone/tablet and desktop layouts are independent."
            )}
          </WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody>
          <div
            aria-label={t("components.device", "Layout device")}
            className="mb-4 flex flex-wrap gap-2"
            role="group"
          >
            {(["desktop", "mobile"] as const).map((value) => (
              <Button
                aria-pressed={target === value}
                key={value}
                onClick={() => setTarget(value)}
                size="sm"
                variant={target === value ? "default" : "outline"}
              >
                {t(
                  `components.${value}`,
                  value === "desktop" ? "Desktop" : "Phone / tablet"
                )}
              </Button>
            ))}
          </div>
          <div
            aria-label={t("components.presets", "Presets")}
            className="mb-5 flex flex-wrap gap-2"
            role="group"
          >
            {(["operations", "infrastructure", "minimal"] as const).map(
              (preset) => (
                <Button
                  key={preset}
                  onClick={() =>
                    updateLayout(target, () => dashboardPreset(preset))
                  }
                  size="sm"
                  variant="outline"
                >
                  {t(
                    `components.preset.${preset}`,
                    preset === "operations"
                      ? "Operations"
                      : preset === "infrastructure"
                        ? "Infrastructure"
                        : "Minimal"
                  )}
                </Button>
              )
            )}
          </div>
          <ol className="divide-y rounded-xl border">
            {layout.order.map((id, index) => {
              const name = t(`components.modules.${id}`, MODULE_LABELS[id]);
              return (
                <li
                  className="flex min-w-0 items-center gap-2 px-3 py-2"
                  key={id}
                >
                  <Switch
                    aria-label={name}
                    checked={!layout.hidden.includes(id)}
                    id={`dashboard-module-${id}`}
                    onCheckedChange={(visible) =>
                      updateLayout(target, (current) => ({
                        ...current,
                        hidden: visible
                          ? current.hidden.filter((value) => value !== id)
                          : [...current.hidden, id],
                      }))
                    }
                  />
                  <label
                    className="min-w-0 flex-1 cursor-pointer text-sm"
                    htmlFor={`dashboard-module-${id}`}
                  >
                    {name}
                  </label>
                  <Button
                    aria-label={t("components.moveUp", "Move {{name}} up", {
                      name,
                    })}
                    className="size-11"
                    disabled={index === 0}
                    onClick={() =>
                      updateLayout(target, (current) =>
                        moveDashboardModule(current, id, -1)
                      )
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    aria-label={t("components.moveDown", "Move {{name}} down", {
                      name,
                    })}
                    className="size-11"
                    disabled={index === layout.order.length - 1}
                    onClick={() =>
                      updateLayout(target, (current) =>
                        moveDashboardModule(current, id, 1)
                      )
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <ArrowDown />
                  </Button>
                </li>
              );
            })}
          </ol>
          {unavailable && (
            <p className="mt-3 text-destructive text-sm" role="status">
              {t(
                "components.storageUnavailable",
                "Browser storage is unavailable. Changes apply only to this session."
              )}
            </p>
          )}
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter className="flex-row">
          <Button
            onClick={() =>
              updateLayout(target, () => dashboardPreset("default"))
            }
            variant="outline"
          >
            {t("components.restoreDefault", "Restore this layout")}
          </Button>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </WorkspaceDialog>
  );
}
