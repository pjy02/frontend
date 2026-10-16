import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  SavedTableView,
  TableDensity,
  TablePreferences,
} from "./view-preferences";

export function TableViewSettings({
  preferences,
  unavailable,
  invalidFilters,
  sensitiveFilters,
  onDensity,
  onApply,
  onSave,
  onDelete,
  onRestore,
}: {
  preferences: TablePreferences;
  unavailable: boolean;
  invalidFilters: boolean;
  sensitiveFilters: boolean;
  onDensity: (density: TableDensity) => void;
  onApply: (view: SavedTableView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation("components");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const label = t("table.views.settings", "Table views");
  const full =
    preferences.views.length >= 10 &&
    !preferences.views.some((view) => view.name === name.trim());
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          className="size-11 lg:size-8"
          size="icon"
          title={label}
          variant="ghost"
        >
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(80dvh,640px)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4"
      >
        <h3 className="font-medium text-sm">{label}</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          {t(
            "table.views.localHint",
            "Saved for this administrator and table in this browser."
          )}
        </p>
        <div
          aria-label={t("table.views.density", "Row density")}
          className="mt-4 grid grid-cols-2 gap-2"
          role="group"
        >
          {(["comfortable", "compact"] as const).map((value) => (
            <Button
              aria-pressed={preferences.density === value}
              className="min-h-11"
              key={value}
              onClick={() => onDensity(value)}
              size="sm"
              variant={preferences.density === value ? "default" : "outline"}
            >
              {t(
                `table.views.${value}`,
                value === "compact" ? "Compact" : "Comfortable"
              )}
            </Button>
          ))}
        </div>
        <h4 className="mt-4 font-medium text-sm">
          {t("table.views.saved", "Saved views")}
        </h4>
        {preferences.views.length ? (
          <ul className="mt-2 divide-y">
            {preferences.views.map((view) => (
              <li className="flex min-w-0 items-center gap-1" key={view.id}>
                <Button
                  className="min-h-11 min-w-0 flex-1 justify-start"
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                  title={view.name}
                  variant="ghost"
                >
                  <span className="truncate">{view.name}</span>
                </Button>
                <Button
                  aria-label={t("table.views.delete", "Delete view {{name}}", {
                    name: view.name,
                  })}
                  className="size-11 shrink-0"
                  onClick={() => onDelete(view.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground text-xs">
            {t("table.views.empty", "No saved views yet.")}
          </p>
        )}
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !full && !invalidFilters && !sensitiveFilters) {
              onSave(name.trim());
              setName("");
            }
          }}
        >
          <Input
            aria-label={t("table.views.name", "View name")}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("table.views.name", "View name")}
            value={name}
          />
          <Button
            className="min-h-11"
            disabled={
              !name.trim() || full || invalidFilters || sensitiveFilters
            }
            size="sm"
            type="submit"
          >
            {preferences.views.some((view) => view.name === name.trim())
              ? t("table.views.update", "Update named view")
              : t("table.views.save", "Save current view")}
          </Button>
          {full && (
            <p className="text-muted-foreground text-xs" role="status">
              {t(
                "table.views.limit",
                "Keep up to 10 views per table. Remove one before saving another."
              )}
            </p>
          )}
          {invalidFilters && (
            <p className="text-destructive text-xs" role="status">
              {t(
                "table.views.invalid",
                "Correct the filters before saving this view."
              )}
            </p>
          )}
          {sensitiveFilters && (
            <p className="text-destructive text-xs" role="status">
              {t(
                "table.views.sensitive",
                "This view contains a token, unsupported value or oversized filter. Remove it before saving."
              )}
            </p>
          )}
        </form>
        <div className="mt-4 border-t pt-3">
          <Button
            className="min-h-11 w-full"
            onClick={onRestore}
            size="sm"
            variant="outline"
          >
            {t("table.views.restore", "Restore table defaults")}
          </Button>
          <p className="mt-2 text-muted-foreground text-xs">
            {t(
              "table.views.restoreHint",
              "Restores filters, columns and density. Saved views are kept."
            )}
          </p>
        </div>
        {unavailable && (
          <p className="mt-3 text-destructive text-xs" role="status">
            {t(
              "table.views.unavailable",
              "Browser storage is unavailable. Changes apply only to this session."
            )}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
