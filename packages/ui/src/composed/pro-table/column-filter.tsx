"use client";

import type { Table } from "@tanstack/react-table";
import { Input } from "@workspace/ui/components/input";
import { Combobox } from "@workspace/ui/composed/combobox";
import { Search } from "lucide-react";

export interface IParams {
  key: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  type?: "text" | "select" | "date";
}
interface ColumnFilterProps<TData> {
  table: Table<TData>;
  params: IParams[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: any;
}

export function ColumnFilter<TData>({
  table,
  params,
  filters,
}: ColumnFilterProps<TData>) {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {params.map((param) => {
        if (param.options || param.type === "select") {
          return (
            <Combobox
              className="h-9 min-w-36 max-w-52 rounded-lg bg-background"
              key={param.key}
              onChange={(value) => {
                updateFilter(param.key, value);
              }}
              options={param.options}
              placeholder={param.placeholder || "Choose..."}
              value={filters[param.key] || ""}
            />
          );
        }
        if (param.type === "date") {
          const raw = filters[param.key];
          const inputValue =
            typeof raw === "number"
              ? toDateInput(new Date(raw))
              : typeof raw === "string"
                ? raw
                : "";
          return (
            <Input
              className="block h-9 min-w-36 rounded-lg bg-background"
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
              isSearch ? "relative min-w-60 flex-1 sm:max-w-80" : "min-w-36"
            }
            key={param.key}
          >
            {isSearch ? (
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            ) : null}
            <Input
              className={
                isSearch
                  ? "h-9 rounded-lg bg-background pl-9"
                  : "h-9 rounded-lg bg-background"
              }
              onChange={(event) => updateFilter(param.key, event.target.value)}
              placeholder={param.placeholder || "Search..."}
              value={filters[param.key] || ""}
            />
          </div>
        );
      })}
    </div>
  );
}
