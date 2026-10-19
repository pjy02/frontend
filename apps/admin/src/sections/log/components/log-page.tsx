"use client";

import {
  useElementScrollRestoration,
  useLocation,
  useMatch,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  ProTable,
  type ProTableProps,
} from "@workspace/ui/composed/pro-table/pro-table";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import {
  getTablePagination,
  useTablePaginationSearchParams,
  useTableSearchWriter,
} from "@/utils/use-table-search-params";
import {
  getLogInitialFilters,
  localLogDate,
  validateLogRange,
  writeLogFilters,
} from "./log-filters";

type FilterValueType = "number" | "string";
const logScrollPositions = new Map<
  string,
  { scrollX: number; scrollY: number }
>();

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
    filters: TFilters,
    context: { signal: AbortSignal }
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

export function LogPage<
  TData extends Record<string, unknown> & { id?: string | number },
  TFilters extends Record<string, unknown>,
>({
  title,
  description,
  filterTypes,
  load,
  mobile,
  params = [],
  ...tableProps
}: LogPageProps<TData, TFilters>) {
  const { t } = useTranslation("log");
  const router = useRouter();
  const ownerPathname = useMatch({
    strict: false,
    select: (match) => match.pathname,
  });
  const savedScroll = useElementScrollRestoration({ getElement: () => window });
  const historyKey = useLocation({
    select: (location) => location.state.__TSR_key,
  });
  const scrollEntry =
    (historyKey && logScrollPositions.get(historyKey)) || savedScroll;
  const pendingScroll = useRef({
    key: historyKey,
    entry: scrollEntry ? { ...scrollEntry } : undefined,
  });
  if (pendingScroll.current.key !== historyKey) {
    pendingScroll.current = {
      key: historyKey,
      entry: scrollEntry ? { ...scrollEntry } : undefined,
    };
  }
  useEffect(() => {
    const remember = () => {
      const key = pendingScroll.current.key;
      if (
        !key ||
        pendingScroll.current.entry ||
        router.history.location.pathname !== ownerPathname
      )
        return;
      // Keep a bounded copy before navigation/skeleton clamping can overwrite
      // the framework's window entry. Never capture a different route's scroll.
      logScrollPositions.delete(key);
      logScrollPositions.set(key, {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
      if (logScrollPositions.size > 64)
        logScrollPositions.delete(
          logScrollPositions.keys().next().value as string
        );
    };
    window.addEventListener("scroll", remember, { passive: true });
    const cancel = () => {
      pendingScroll.current.entry = undefined;
    };
    const cancelKey = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("keydown", cancelKey);
    return () => {
      window.removeEventListener("scroll", remember);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancelKey);
    };
  }, [router, ownerPathname]);
  const restoreAfterData = useCallback(() => {
    const entry = pendingScroll.current.entry;
    pendingScroll.current.entry = undefined;
    if (entry && (entry.scrollY || entry.scrollX))
      window.scrollTo({
        top: entry.scrollY,
        left: entry.scrollX,
        behavior: "instant",
      });
  }, []);
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const initialFilters = getLogInitialFilters(search, filterTypes);
  const writeSearch = useTableSearchWriter();
  const filterKeys = [
    ...new Set([...Object.keys(filterTypes), "start_date", "end_date"]),
  ]
    .filter((key) => key !== "date")
    .join("|");
  const syncFilters = useCallback(
    (filters: Record<string, unknown>) => {
      writeSearch((searchParams) =>
        writeLogFilters(searchParams, filterKeys.split("|"), filters)
      );
    },
    [filterKeys, writeSearch]
  );
  const rangeParams = [
    {
      key: "start_date",
      type: "date" as const,
      label: t("startDate", "Start date"),
    },
    { key: "end_date", type: "date" as const, label: t("endDate", "End date") },
  ];
  const otherParams = params.filter(
    (param) => !["date", "start_date", "end_date"].includes(param.key)
  );
  const searchParam = otherParams.find((param) => param.key === "search") || {
    key: "search",
    label: t("column.logSearch", "Search logs"),
    placeholder: t("column.logSearch", "Search logs"),
  };
  const logParams = [
    searchParam,
    ...rangeParams,
    ...otherParams.filter((param) => param.key !== "search"),
  ];
  const initialPagination = getTablePagination(search);
  const syncPagination = useTablePaginationSearchParams();

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
        initialPagination={initialPagination}
        mobile={mobile === undefined ? { detailsLimit: 2 } : mobile}
        mobileFilterMode="drawer"
        onDataReady={restoreAfterData}
        onFiltersChange={syncFilters}
        onPaginationChange={syncPagination}
        params={logParams}
        request={async (pagination, filters, context) =>
          normalizeLogResponse<TData>(await load(pagination, filters, context))
        }
        resetFilters={{ start_date: localLogDate(), end_date: localLogDate() }}
        validateFilters={(filters) => {
          const error = validateLogRange(filters);
          return error === "reversed"
            ? t("range.reversed", "Start date must not be later than end date.")
            : error === "invalid"
              ? t("range.invalid", "Enter a valid date in YYYY-MM-DD format.")
              : undefined;
        }}
      />
    </div>
  );
}
