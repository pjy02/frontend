"use client";

import { useSearch } from "@tanstack/react-router";
import {
  ProTable,
  type ProTableProps,
} from "@workspace/ui/composed/pro-table/pro-table";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { useTableSearchParams } from "@/utils/use-table-search-params";

type FilterValueType = "number" | "string";

interface LogPageProps<
  TData extends Record<string, unknown> & { id?: string | number },
  TFilters extends Record<string, unknown>,
> extends Pick<
    ProTableProps<TData, TFilters>,
    "actions" | "columns" | "empty" | "mobile" | "params" | "texts"
  > {
  title: React.ReactNode;
  description: React.ReactNode;
  filterTypes: Record<string, FilterValueType>;
  load: (
    pagination: { page: number; size: number },
    filters: TFilters
  ) => Promise<unknown>;
}

interface LogResponse<TData> {
  data?: {
    data?: {
      list?: TData[];
      total?: number;
    };
  };
}

function normalizeLogResponse<TData>(response: unknown) {
  const payload = (response as LogResponse<TData>)?.data?.data;
  const list = payload?.list ?? [];
  return {
    list,
    total: Number(payload?.total ?? list.length),
  };
}

function getInitialFilters(
  search: Record<string, string | undefined>,
  filterTypes: Record<string, FilterValueType>
) {
  const today = new Date().toISOString().split("T")[0];

  return Object.fromEntries(
    Object.entries(filterTypes).flatMap(([key, type]) => {
      const rawValue = search[key] || (key === "date" ? today : undefined);
      if (rawValue === undefined) {
        return [];
      }

      const value = type === "number" ? Number(rawValue) : rawValue;
      if (type === "number" && Number.isNaN(value)) {
        return [];
      }
      return [[key, value]];
    })
  );
}

export function LogPage<
  TData extends Record<string, unknown> & { id?: string | number },
  TFilters extends Record<string, unknown>,
>({
  title,
  description,
  filterTypes,
  load,
  mobile,
  ...tableProps
}: LogPageProps<TData, TFilters>) {
  const { t } = useTranslation("log");
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const initialFilters = getInitialFilters(search, filterTypes);
  const syncFilters = useTableSearchParams(Object.keys(filterTypes));

  return (
    <div className="space-y-6">
      <PageHeader
        description={description}
        eyebrow={t("analytics", "Logs & analytics")}
        title={title}
      />
      <ProTable<TData, TFilters>
        {...tableProps}
        header={{ title: t("records", "Records") }}
        initialFilters={initialFilters}
        mobile={mobile === undefined ? { detailsLimit: 2 } : mobile}
        onFiltersChange={syncFilters}
        request={async (pagination, filters) =>
          normalizeLogResponse<TData>(await load(pagination, filters))
        }
      />
    </div>
  );
}
