"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
  ColumnFilter,
  type IParams,
} from "@workspace/ui/composed/pro-table/column-filter";
import { ColumnToggle } from "@workspace/ui/composed/pro-table/column-toggle";
import { ListRestart, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";

interface DataToolbarProps<TData> {
  table: Table<TData>;
  params?: IParams[];
  filters?: Record<string, unknown>;
  title?: ReactNode;
  toolbar?: ReactNode | ReactNode[];
  loading?: boolean;
  mobileCards?: boolean;
  onRefresh: () => void;
  onReset: () => void;
  labels?: Partial<{
    refresh: string;
    reset: string;
    columns: string;
  }>;
}

export function DataToolbar<TData>({
  table,
  params,
  filters,
  title,
  toolbar,
  loading,
  mobileCards,
  onRefresh,
  onReset,
  labels,
}: DataToolbarProps<TData>) {
  return (
    <div
      className="rounded-xl border bg-card p-3 shadow-none"
      data-slot="data-toolbar"
    >
      <div className="admin-data-toolbar__layout flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="admin-data-toolbar__filters flex min-w-0 flex-1 flex-col gap-3">
          {title ? (
            <div className="px-1 font-medium text-sm">{title}</div>
          ) : null}
          {params?.length ? (
            <ColumnFilter filters={filters} params={params} table={table} />
          ) : null}
        </div>

        <div className="admin-data-toolbar__controls flex w-full shrink-0 flex-wrap items-center justify-between gap-2 xl:w-auto xl:justify-start">
          <div className="flex items-center rounded-lg border bg-background p-0.5">
            <Button
              aria-busy={loading}
              aria-label={labels?.refresh || "Refresh data"}
              className="size-8"
              disabled={loading}
              onClick={onRefresh}
              size="icon"
              title={labels?.refresh || "Refresh data"}
              variant="ghost"
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} />
            </Button>
            <div className={mobileCards ? "hidden lg:block" : undefined}>
              <ColumnToggle table={table} title={labels?.columns} />
            </div>
            <Button
              aria-label={labels?.reset || "Reset table"}
              className="size-8"
              onClick={onReset}
              size="icon"
              title={labels?.reset || "Reset table"}
              variant="ghost"
            >
              <ListRestart />
            </Button>
          </div>
          {toolbar ? (
            <div className="admin-data-toolbar__actions flex min-w-0 flex-wrap items-center justify-end gap-2">
              {toolbar}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
