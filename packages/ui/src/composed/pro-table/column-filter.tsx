"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { Input } from "@workspace/ui/components/input";
import { useMotionProfile } from "@workspace/ui/components/motion-profile";
import { Combobox } from "@workspace/ui/composed/combobox";
import { Search, SlidersHorizontal } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface IParams {
  key: string;
  label?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  type?: "text" | "select" | "date";
}
interface ColumnFilterProps<TData> {
  table: Table<TData>;
  params: IParams[];
  mobileMode?: "inline" | "drawer";
  resetKey?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: any;
}

export function ColumnFilter<TData>({
  table,
  params,
  filters,
  mobileMode = "inline",
  resetKey,
}: ColumnFilterProps<TData>) {
  const { t } = useTranslation("components");
  const debounceText = Boolean(useMotionProfile());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFilter = (key: string, value: any) => {
    table.setColumnFilters((prev) => {
      const newFilters = prev.filter((filter) => filter.id !== key);
      if (value) {
        newFilters.push({ id: key, value });
      }
      return newFilters;
    });
    table.setPageIndex(0);
  };

  const toDateInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    return `${yyyy}-${MM}-${dd}`;
  };

  const renderFilter = (param: IParams, fullWidth = false) => {
    if (param.options || param.type === "select") {
      return (
        <Combobox
          className={
            fullWidth
              ? "h-10 w-full min-w-0 rounded-lg bg-background"
              : "h-9 w-full min-w-0 rounded-lg bg-background sm:w-auto sm:min-w-36 sm:max-w-52"
          }
          key={param.key}
          onChange={(value) => {
            updateFilter(param.key, value);
          }}
          options={param.options}
          placeholder={param.placeholder || t("table.choose", "Choose...")}
          value={filters?.[param.key] || ""}
        />
      );
    }
    if (param.type === "date") {
      const raw = filters?.[param.key];
      const inputValue =
        typeof raw === "number"
          ? toDateInput(new Date(raw))
          : typeof raw === "string"
            ? raw
            : "";
      return (
        <Input
          aria-label={
            param.label || param.placeholder || t("table.date", "Date")
          }
          className={
            fullWidth
              ? "block h-10 w-full min-w-0 rounded-lg bg-background"
              : "block h-9 w-full min-w-0 rounded-lg bg-background sm:w-auto sm:min-w-36"
          }
          key={param.key}
          onChange={(event) => {
            const v = event.target.value;
            updateFilter(param.key, v || "");
          }}
          placeholder={param.placeholder}
          type="date"
          value={inputValue}
        />
      );
    }
    const isSearch = param.key === "search";
    return (
      <div
        className={
          fullWidth
            ? "relative min-w-0 flex-1"
            : isSearch
              ? "relative min-w-0 flex-1 sm:min-w-60 sm:max-w-80"
              : "min-w-0 sm:min-w-36"
        }
        key={param.key}
      >
        {isSearch ? (
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
        ) : null}
        <FilterTextInput
          aria-label={
            param.placeholder ||
            (isSearch
              ? t("table.search", "Search")
              : t("table.filter", "Filter"))
          }
          className={
            isSearch
              ? fullWidth
                ? "h-10 rounded-lg bg-background pl-9"
                : "h-9 rounded-lg bg-background pl-9"
              : fullWidth
                ? "h-10 rounded-lg bg-background"
                : "h-9 rounded-lg bg-background"
          }
          debounce={debounceText}
          onValueChange={(value) => updateFilter(param.key, value)}
          placeholder={
            param.placeholder ||
            (isSearch
              ? t("table.searchPlaceholder", "Search...")
              : t("table.filterPlaceholder", "Filter..."))
          }
          resetKey={resetKey}
          value={filters?.[param.key] || ""}
        />
      </div>
    );
  };

  if (mobileMode === "drawer" && params.length > 1) {
    const [primaryParam, ...advancedParams] = params;
    const advancedKeys = new Set(advancedParams.map((param) => param.key));
    const activeAdvancedCount = advancedParams.filter((param) => {
      const value = filters?.[param.key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length;
    const clearAdvancedFilters = () => {
      table.setColumnFilters((previous) =>
        previous.filter((filter) => !advancedKeys.has(filter.id))
      );
      table.setPageIndex(0);
    };

    return (
      <>
        <div className="flex w-full min-w-0 items-center gap-2 lg:hidden">
          {primaryParam ? renderFilter(primaryParam, true) : null}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                aria-label={t("table.moreFilters", "More filters")}
                className="h-10 shrink-0 gap-1.5 rounded-lg px-3"
                variant="outline"
              >
                <SlidersHorizontal />
                <span>{t("table.filter", "Filter")}</span>
                {activeAdvancedCount > 0 ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs tabular-nums">
                    {activeAdvancedCount}
                  </span>
                ) : null}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <DrawerHeader className="text-left">
                <DrawerTitle>
                  {t("table.moreFilters", "More filters")}
                </DrawerTitle>
                <DrawerDescription>
                  {t(
                    "table.filterDescription",
                    "Narrow the current list with additional conditions."
                  )}
                </DrawerDescription>
              </DrawerHeader>
              <div className="grid min-h-0 gap-3 overflow-y-auto px-4 pb-4">
                {advancedParams.map((param) =>
                  param.label ? (
                    <div
                      className="grid min-w-0 gap-1.5 text-sm"
                      key={param.key}
                    >
                      <span className="text-muted-foreground">
                        {param.label}
                      </span>
                      {renderFilter(param, true)}
                    </div>
                  ) : (
                    renderFilter(param, true)
                  )
                )}
              </div>
              <DrawerFooter className="grid grid-cols-2 border-t">
                <Button
                  disabled={activeAdvancedCount === 0}
                  onClick={clearAdvancedFilters}
                  variant="outline"
                >
                  {t("table.clearFilters", "Clear filters")}
                </Button>
                <DrawerClose asChild>
                  <Button>{t("table.done", "Done")}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
        <div className="hidden w-full flex-wrap items-center gap-2 lg:flex">
          {params.map((param) => renderFilter(param))}
        </div>
      </>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {params.map((param) => renderFilter(param))}
    </div>
  );
}

export function FilterTextInput({
  value,
  onValueChange,
  debounce,
  resetKey,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  debounce: boolean;
  resetKey?: number;
}) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = useRef(onValueChange);
  commit.current = onValueChange;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    clear();
    setDraft(value);
  }, [value, resetKey]);
  useEffect(() => clear, []);
  const schedule = (next: string, immediate = false) => {
    clear();
    if (next === value) return;
    if (!debounce || immediate) commit.current(next);
    else
      timer.current = setTimeout(() => {
        timer.current = null;
        commit.current(next);
      }, 300);
  };
  return (
    <Input
      {...props}
      onChange={(event) => {
        setDraft(event.target.value);
        if (!composing.current) schedule(event.target.value);
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        schedule(event.currentTarget.value);
      }}
      onCompositionStart={() => {
        composing.current = true;
        clear();
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (
          event.key === "Enter" &&
          !composing.current &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          schedule(event.currentTarget.value, true);
        }
      }}
      value={draft}
    />
  );
}
