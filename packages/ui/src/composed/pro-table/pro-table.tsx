"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import Empty from "@workspace/ui/composed/empty";
import type { IParams } from "@workspace/ui/composed/pro-table/column-filter";
import { ColumnHeader } from "@workspace/ui/composed/pro-table/column-header";
import { DataToolbar } from "@workspace/ui/composed/pro-table/data-toolbar";
import { Pagination } from "@workspace/ui/composed/pro-table/pagination";
import { SortableMobileCard } from "@workspace/ui/composed/pro-table/sortable-mobile-card";
import { SortableRow } from "@workspace/ui/composed/pro-table/sortable-row";
import { ProTableWrapper } from "@workspace/ui/composed/pro-table/wrapper";
import { useReducedMotion } from "@workspace/ui/hooks/use-reduced-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  ShieldX,
  TriangleAlert,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  getPageDirection,
  getRowFeedback,
  getRowIdentity,
  type PageDirection,
  type RowFeedback,
} from "./data-continuity.js";

export interface ProTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  request: (
    pagination: {
      page: number;
      size: number;
    },
    filter: TValue
  ) => Promise<{ list: TData[]; total: number }>;
  params?: IParams[];
  header?: {
    title?: React.ReactNode;
    toolbar?: React.ReactNode | React.ReactNode[];
    hidden?: boolean;
  };
  actions?: {
    render?: (row: TData) => React.ReactNode[];
    batchRender?: (rows: TData[]) => React.ReactNode[];
    visibleCount?: number;
  };
  mobile?:
    | {
        detailsLimit?: number;
        render?: (row: TData) => React.ReactNode;
        getAriaLabel?: (row: TData) => string;
      }
    | false;
  mobileFilterMode?: "inline" | "drawer";
  pagination?: boolean;
  action?: React.Ref<ProTableActions | undefined>;
  texts?: Partial<{
    actions: string;
    asc: string;
    desc: string;
    hide: string;
    textRowsPerPage: string;
    textPageOf: (current: number, total: number) => string;
    selectedRowsText: (total: number) => string;
    refresh: string;
    reset: string;
    columns: string;
    fetchError: string;
    permissionDenied: string;
    retry: string;
    moreActions: string;
  }>;
  empty?: React.ReactNode;
  onSort?: (
    sourceId: string | number,
    targetId: string | number | null,
    items: TData[]
  ) => Promise<TData[]>;
  onFiltersChange?: (filters: Record<string, unknown>) => void;
  initialFilters?: Record<string, unknown>;
  onPaginationChange?: (pagination: ProTablePagination) => void;
  initialPagination?: Partial<ProTablePagination>;
}

export interface ProTablePagination {
  page: number;
  size: number;
}

export interface ProTableActions {
  refresh: () => void;
  reset: () => void;
}

export function ProTable<
  TData extends Record<string, unknown> & { id?: string | number },
  TValue extends Record<string, unknown>,
>({
  columns,
  request,
  params,
  header,
  actions,
  action,
  texts,
  empty,
  onSort,
  onFiltersChange,
  initialFilters,
  onPaginationChange,
  initialPagination,
  mobile,
  mobileFilterMode,
  pagination: paginationEnabled = true,
}: ProTableProps<TData, TValue>) {
  const { t } = useTranslation("components");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() =>
    toColumnFilters(initialFilters || {})
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [data, setData] = useState<TData[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const normalizedInitialPagination = normalizePagination(initialPagination);
  const initialPageIndex = normalizedInitialPagination.pageIndex;
  const initialPageSize = normalizedInitialPagination.pageSize;
  const [pagination, setPagination] = useState(normalizedInitialPagination);
  const requestIdRef = useRef(0);
  const onFiltersChangeRef = useRef(onFiltersChange);
  const onPaginationChangeRef = useRef(onPaginationChange);
  const initialFiltersRef = useRef(initialFilters);
  const initialFiltersSnapshot = serializeColumnFilters(
    toColumnFilters(initialFilters || {})
  );
  const previousInitialFiltersRef = useRef(initialFiltersSnapshot);
  const initialPaginationSnapshot = serializePagination(
    normalizedInitialPagination
  );
  const previousInitialPaginationRef = useRef(initialPaginationSnapshot);
  onFiltersChangeRef.current = onFiltersChange;
  onPaginationChangeRef.current = onPaginationChange;
  initialFiltersRef.current = initialFilters;
  const [isLoading, setIsLoading] = useState(false);
  const dataRef = useRef<TData[]>([]);
  const lastLoadedPageRef = useRef(normalizedInitialPagination.pageIndex);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageDirection, setPageDirection] = useState<PageDirection>("none");
  const [pageTransitionVersion, setPageTransitionVersion] = useState(0);
  const [refreshSucceeded, setRefreshSucceeded] = useState(false);
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback>>(
    {}
  );
  const reducedMotion = useReducedMotion();
  const adminMotionEnabled =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("admin-console") &&
    !reducedMotion;
  const mobileCardsEnabled = mobile !== false;
  const [fetchError, setFetchError] = useState<"error" | "forbidden" | null>(
    null
  );
  const setContinuousData: React.Dispatch<React.SetStateAction<TData[]>> = (
    nextValue
  ) => {
    setData((currentData) => {
      const nextData =
        typeof nextValue === "function" ? nextValue(currentData) : nextValue;
      dataRef.current = nextData;
      return nextData;
    });
  };

  const table = useReactTable({
    data,
    columns: [
      ...(onSort
        ? [
            {
              id: "sortable",
              header: (
                <GripVertical className="h-4 w-4 cursor-move text-muted-foreground hover:text-foreground" />
              ),
              enableSorting: false,
              enableHiding: false,
            },
          ]
        : []),
      ...(actions?.batchRender
        ? [
            createSelectColumn<TData, TValue>({
              selectAll: t("table.selectAll", "Select all rows on this page"),
              selectRow: t("table.selectRow", "Select row"),
            }),
          ]
        : []),
      ...columns.map(
        (column) =>
          ({
            enableSorting: false,
            ...column,
          }) as ColumnDef<TData, TValue>
      ),
      ...(actions?.render
        ? ([
            {
              id: "actions",
              header: texts?.actions,
              cell: ({ row }) => (
                <RowActions
                  items={actions?.render?.(row.original) || []}
                  moreLabel={
                    texts?.moreActions || t("table.moreActions", "More actions")
                  }
                  visibleCount={actions.visibleCount}
                />
              ),
              enableSorting: false,
              enableHiding: false,
            },
          ] as ColumnDef<TData, TValue>[])
        : []),
    ] as ColumnDef<TData, TValue>[],
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      setColumnFilters((current) =>
        typeof updater === "function" ? updater(current) : updater
      );
      setPagination((current) =>
        current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row, index) => getRowIdentity(row, index),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    manualPagination: true,
    manualFiltering: true,
    rowCount,
    manualSorting: true,
  });

  const fetchData = async (showRefreshFeedback = false) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setFetchError(null);
    if (showRefreshFeedback) setRefreshSucceeded(false);
    try {
      const response = await request(
        {
          page: pagination.pageIndex + 1,
          size: pagination.pageSize,
        },
        Object.fromEntries(
          columnFilters.map((item) => [item.id, item.value])
        ) as TValue
      );
      if (requestId === requestIdRef.current) {
        const previousData = dataRef.current;
        const nextFeedback = getRowFeedback(previousData, response.list);
        const nextPageDirection = getPageDirection(
          lastLoadedPageRef.current,
          pagination.pageIndex
        );

        dataRef.current = response.list;
        setData(response.list);
        setRowCount(response.total);
        setRowFeedback(previousData.length > 0 ? nextFeedback : {});
        setPageDirection(nextPageDirection);
        if (nextPageDirection !== "none") {
          setPageTransitionVersion((version) => version + 1);
        }
        lastLoadedPageRef.current = pagination.pageIndex;

        if (feedbackTimerRef.current) {
          clearTimeout(feedbackTimerRef.current);
        }
        feedbackTimerRef.current = setTimeout(() => setRowFeedback({}), 900);

        if (showRefreshFeedback) {
          setRefreshSucceeded(true);
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(
            () => setRefreshSucceeded(false),
            900
          );
        }
      }
    } catch (error) {
      console.error("Fetch data error:", error);
      if (requestId === requestIdRef.current) {
        const candidate = error as {
          code?: number;
          status?: number;
          response?: {
            status?: number;
            data?: { code?: number; data?: { code?: number } };
          };
        };
        const code =
          candidate?.response?.data?.data?.code ??
          candidate?.response?.data?.code ??
          candidate?.response?.status ??
          candidate?.status ??
          candidate?.code;
        if (dataRef.current.length === 0) {
          setData([]);
          setRowCount(0);
        }
        setFetchError(code === 403 || code === 40_005 ? "forbidden" : "error");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };
  const reset = async () => {
    setSorting([]);
    setColumnFilters([]);
    setColumnVisibility({});
    setRowSelection({});
    setPagination((current) => ({ ...current, pageIndex: 0, pageSize: 10 }));
    table.resetGlobalFilter(true);
  };
  useImperativeHandle(action, () => ({
    refresh: () => fetchData(),
    reset,
  }));

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    []
  );

  const filtersSnapshot = serializeColumnFilters(columnFilters);
  const paginationSnapshot = serializePagination(pagination);

  useEffect(() => {
    if (previousInitialFiltersRef.current === initialFiltersSnapshot) {
      return;
    }
    previousInitialFiltersRef.current = initialFiltersSnapshot;
    const nextFilters = toColumnFilters(initialFiltersRef.current || {});
    setColumnFilters((current) =>
      serializeColumnFilters(current) === initialFiltersSnapshot
        ? current
        : nextFilters
    );
    setPagination((current) =>
      serializePagination(current) === initialPaginationSnapshot
        ? current
        : { pageIndex: initialPageIndex, pageSize: initialPageSize }
    );
  }, [
    initialFiltersSnapshot,
    initialPaginationSnapshot,
    initialPageIndex,
    initialPageSize,
  ]);

  useEffect(() => {
    if (previousInitialPaginationRef.current === initialPaginationSnapshot) {
      return;
    }
    previousInitialPaginationRef.current = initialPaginationSnapshot;
    setPagination((current) =>
      serializePagination(current) === initialPaginationSnapshot
        ? current
        : { pageIndex: initialPageIndex, pageSize: initialPageSize }
    );
  }, [initialPaginationSnapshot, initialPageIndex, initialPageSize]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, filtersSnapshot]);

  useEffect(() => {
    onFiltersChangeRef.current?.(
      Object.fromEntries(
        columnFilters.map((filter) => [filter.id, filter.value])
      )
    );
    // The serialized value changes only when the committed filters change;
    // callback identity changes must not cause router update loops.
  }, [filtersSnapshot]);

  useEffect(() => {
    onPaginationChangeRef.current?.({
      page: pagination.pageIndex + 1,
      size: pagination.pageSize,
    });
  }, [paginationSnapshot, pagination.pageIndex, pagination.pageSize]);

  const selectedRows = table
    .getSelectedRowModel()
    .flatRows.map((row) => row.original);
  const selectedCount = selectedRows.length;

  return (
    <div
      aria-busy={isLoading}
      className="admin-pro-table flex min-w-0 flex-col gap-4"
      data-loading={isLoading}
      data-refreshing={isLoading && data.length > 0}
      data-selection-active={selectedCount > 0 && Boolean(actions?.batchRender)}
    >
      {!header?.hidden && (
        <DataToolbar
          filters={Object.fromEntries(
            columnFilters.map((item) => [item.id, item.value])
          )}
          labels={{
            columns: texts?.columns || t("table.columns", "Choose columns"),
            refresh: texts?.refresh || t("table.refresh", "Refresh data"),
            refreshed: t("table.refreshed", "Data refreshed"),
            refreshing: t("table.refreshing", "Refreshing data"),
            reset: texts?.reset || t("table.reset", "Reset table"),
          }}
          loading={isLoading}
          mobileCards={mobileCardsEnabled}
          mobileFilterMode={mobileFilterMode}
          onRefresh={() => fetchData(true)}
          onReset={reset}
          params={params}
          refreshSucceeded={refreshSucceeded}
          table={table}
          title={header?.title}
          toolbar={header?.toolbar}
        />
      )}

      {fetchError && data.length > 0 ? (
        <div
          className="admin-pro-table-stale-alert flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm"
          role="alert"
        >
          <span className="min-w-0 text-destructive">
            {texts?.fetchError ||
              t(
                "table.staleData",
                "Refresh failed. Showing the previously loaded data."
              )}
          </span>
          <Button
            loading={isLoading}
            loadingLabel={t("table.refreshing", "Refreshing data")}
            onClick={() => fetchData(true)}
            size="sm"
            variant="outline"
          >
            {texts?.retry || t("table.retry", "Try again")}
          </Button>
        </div>
      ) : null}

      {actions?.batchRender &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence initial={false}>
            {selectedCount > 0 ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center sm:inset-x-6 sm:bottom-[calc(1rem+env(safe-area-inset-bottom))]"
                exit={adminMotionEnabled ? { opacity: 0, y: 8 } : undefined}
                initial={adminMotionEnabled ? { opacity: 0, y: 8 } : false}
                key="batch-actions"
                transition={{ duration: adminMotionEnabled ? 0.18 : 0 }}
              >
                <div
                  aria-label={t("table.batchActions", "Batch actions")}
                  className="admin-batch-actions pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-popover/95 p-2 pl-3 text-popover-foreground shadow-xl backdrop-blur-md sm:justify-start"
                  role="toolbar"
                >
                  <span
                    aria-live="polite"
                    className="shrink-0 font-medium text-sm"
                  >
                    {texts?.selectedRowsText?.(selectedCount) ||
                      t("table.selectedRows", "Selected {{count}} rows", {
                        count: selectedCount,
                      })}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-end">
                    {actions.batchRender(selectedRows)}
                  </div>
                  <Button
                    aria-label={t("table.clearSelection", "Clear selection")}
                    className="ml-0 rounded-full sm:ml-1"
                    onClick={() => table.resetRowSelection()}
                    size="icon-sm"
                    title={t("table.clearSelection", "Clear selection")}
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )}

      {mobileCardsEnabled ? (
        <ProTableWrapper
          data={data}
          onSort={onSort}
          setData={setContinuousData}
        >
          <div
            className="admin-pro-table-mobile grid gap-3 lg:hidden"
            data-page-direction={pageDirection}
            key={`mobile-page-${pageTransitionVersion}`}
          >
            {table.getRowModel().rows.length ? (
              <AnimatePresence initial={false} mode="popLayout">
                {table.getRowModel().rows.map((row) => {
                  const rowActions = actions?.render?.(row.original) || [];
                  const label = mobile?.getAriaLabel
                    ? mobile.getAriaLabel(row.original)
                    : t("table.recordLabel", "Record {{number}}", {
                        number: row.index + 1,
                      });
                  const body = mobile?.render ? (
                    mobile.render(row.original)
                  ) : (
                    <DefaultMobileCard
                      detailsLimit={mobile?.detailsLimit}
                      row={row}
                    />
                  );
                  const selection = actions?.batchRender ? (
                    <Checkbox
                      aria-label={t("table.selectRow", "Select row")}
                      checked={row.getIsSelected()}
                      className="admin-pro-table-selection"
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                    />
                  ) : null;
                  const rowActionsMenu = (
                    <RowActions
                      items={rowActions}
                      moreLabel={
                        texts?.moreActions ||
                        t("table.moreActions", "More actions")
                      }
                      visibleCount={actions?.visibleCount}
                    />
                  );
                  const feedback = rowFeedback[row.id];

                  if (onSort) {
                    return (
                      <SortableMobileCard
                        dragLabel={t("table.reorderRow", "Reorder")}
                        feedback={feedback}
                        footerEnd={rowActionsMenu}
                        footerStart={selection}
                        id={row.id}
                        key={row.id}
                        label={label}
                        motionEnabled={adminMotionEnabled}
                        selected={row.getIsSelected()}
                      >
                        {body}
                      </SortableMobileCard>
                    );
                  }

                  return (
                    <motion.article
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      aria-label={label}
                      className="admin-pro-table-card overflow-hidden rounded-xl border bg-card"
                      data-feedback={feedback}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      exit={
                        adminMotionEnabled
                          ? { opacity: 0, scale: 0.99, y: -4 }
                          : undefined
                      }
                      initial={
                        adminMotionEnabled
                          ? { opacity: 0, scale: 0.99, y: 4 }
                          : false
                      }
                      key={row.id}
                      layout={adminMotionEnabled ? "position" : false}
                      transition={getRowMotionTransition(adminMotionEnabled)}
                    >
                      <div className="p-4">{body}</div>
                      {(actions?.batchRender || rowActions.length > 0) && (
                        <div className="flex min-h-12 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
                          {selection || <span />}
                          {rowActionsMenu}
                        </div>
                      )}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            ) : isLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <div
                  className="space-y-3 rounded-xl border bg-card p-4"
                  key={`mobile-skeleton-${index}`}
                >
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ))
            ) : fetchError ? (
              <div
                className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center"
                role="alert"
              >
                <div
                  className={cn(
                    "grid size-10 place-items-center rounded-full",
                    fetchError === "forbidden"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {fetchError === "forbidden" ? (
                    <ShieldX className="size-5" />
                  ) : (
                    <TriangleAlert className="size-5" />
                  )}
                </div>
                <p className="font-medium text-sm">
                  {fetchError === "forbidden"
                    ? texts?.permissionDenied ||
                      t(
                        "table.permissionDenied",
                        "You do not have permission to view this data"
                      )
                    : texts?.fetchError ||
                      t("table.loadError", "Unable to load data")}
                </p>
                {fetchError === "error" ? (
                  <Button
                    onClick={() => fetchData(true)}
                    size="sm"
                    variant="outline"
                  >
                    {texts?.retry || t("table.retry", "Try again")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border bg-card py-10">
                {empty || <Empty />}
              </div>
            )}
          </div>
        </ProTableWrapper>
      ) : null}

      <div
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border bg-card",
          mobileCardsEnabled && "hidden lg:block"
        )}
      >
        <div aria-hidden="true" className="admin-pro-table-progress" />
        <ProTableWrapper
          data={data}
          onSort={onSort}
          setData={setContinuousData}
        >
          <Table className="w-full">
            <TableHeader className="bg-[color-mix(in_srgb,var(--muted)_45%,var(--card))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className={cn(
                        "!z-auto",
                        getTableHeaderClass(header.column.id)
                      )}
                      key={header.id}
                    >
                      <ColumnHeader
                        header={header}
                        text={{
                          asc: texts?.asc,
                          desc: texts?.desc,
                          hide: texts?.hide,
                        }}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody
              className="admin-pro-table-content"
              data-page-direction={pageDirection}
              key={`table-page-${pageTransitionVersion}`}
            >
              {table.getRowModel()?.rows?.length ? (
                onSort ? (
                  <AnimatePresence initial={false} mode="popLayout">
                    {table.getRowModel().rows.map((row) => (
                      <SortableRow
                        className="h-13"
                        feedback={rowFeedback[row.id]}
                        id={row.id}
                        isSortable
                        key={row.id}
                        motionEnabled={adminMotionEnabled}
                        selected={row.getIsSelected()}
                      >
                        {row
                          .getVisibleCells()
                          .filter((cell) => cell.column.id !== "sortable")
                          .map((cell) => (
                            <TableCell
                              className={getTableCellClass(cell.column.id)}
                              key={cell.id}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                      </SortableRow>
                    ))}
                  </AnimatePresence>
                ) : (
                  <AnimatePresence initial={false} mode="popLayout">
                    {table.getRowModel().rows.map((row) => (
                      <AnimatedTableRow
                        feedback={rowFeedback[row.id]}
                        key={row.id}
                        motionEnabled={adminMotionEnabled}
                        pageDirection={pageDirection}
                        selected={row.getIsSelected()}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            className={getTableCellClass(cell.column.id)}
                            key={cell.id}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </AnimatedTableRow>
                    ))}
                  </AnimatePresence>
                )
              ) : isLoading ? (
                Array.from(
                  { length: Math.min(pagination.pageSize, 6) },
                  (_, rowIndex) => (
                    <TableRow className="h-13" key={`skeleton-${rowIndex}`}>
                      {table.getVisibleLeafColumns().map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton className="h-4 w-[72%] min-w-12" />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                )
              ) : fetchError ? (
                <TableRow>
                  <TableCell
                    className="py-20"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    <div
                      className="flex flex-col items-center gap-3 text-center"
                      role="alert"
                    >
                      <div
                        className={cn(
                          "grid size-10 place-items-center rounded-full",
                          fetchError === "forbidden"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {fetchError === "forbidden" ? (
                          <ShieldX className="size-5" />
                        ) : (
                          <TriangleAlert className="size-5" />
                        )}
                      </div>
                      <p className="font-medium text-sm">
                        {fetchError === "forbidden"
                          ? texts?.permissionDenied ||
                            t(
                              "table.permissionDenied",
                              "You do not have permission to view this data"
                            )
                          : texts?.fetchError ||
                            t("table.loadError", "Unable to load data")}
                      </p>
                      {fetchError === "error" ? (
                        <Button
                          onClick={() => fetchData(true)}
                          size="sm"
                          variant="outline"
                        >
                          {texts?.retry || t("table.retry", "Try again")}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell
                    className="py-24"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    {empty || <Empty />}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ProTableWrapper>
      </div>
      {paginationEnabled && rowCount > 0 && (
        <Pagination
          motionEnabled={adminMotionEnabled}
          table={table}
          total={rowCount}
        />
      )}
    </div>
  );
}

function toColumnFilters(filters: Record<string, unknown>) {
  return Object.entries(filters)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false;
      return typeof value !== "string" || value.trim().length > 0;
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, value]) => ({ id, value })) as ColumnFiltersState;
}

function serializeColumnFilters(filters: ColumnFiltersState) {
  return JSON.stringify(
    filters
      .map((filter) => ({ id: filter.id, value: String(filter.value) }))
      .sort((left, right) => left.id.localeCompare(right.id))
  );
}

function normalizePagination(initial?: Partial<ProTablePagination>) {
  const page = Number(initial?.page);
  const size = Number(initial?.size);
  return {
    pageIndex: Number.isSafeInteger(page) && page > 0 ? page - 1 : 0,
    pageSize: Number.isSafeInteger(size) && size > 0 ? size : 10,
  };
}

function serializePagination(pagination: {
  pageIndex: number;
  pageSize: number;
}) {
  return `${pagination.pageIndex}:${pagination.pageSize}`;
}

function AnimatedTableRow({
  children,
  feedback,
  motionEnabled,
  pageDirection,
  selected,
}: {
  children: React.ReactNode;
  feedback?: RowFeedback;
  motionEnabled: boolean;
  pageDirection: PageDirection;
  selected: boolean;
}) {
  const initialX =
    pageDirection === "forward" ? 6 : pageDirection === "backward" ? -6 : 0;

  return (
    <motion.tr
      animate={{ opacity: 1, x: 0, y: 0 }}
      className="admin-pro-table-row h-13 border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
      data-feedback={feedback}
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      exit={motionEnabled ? { opacity: 0, y: -3 } : undefined}
      initial={motionEnabled ? { opacity: 0, x: initialX, y: 3 } : false}
      layout={motionEnabled ? "position" : false}
      transition={getRowMotionTransition(motionEnabled)}
    >
      {children}
    </motion.tr>
  );
}

function getRowMotionTransition(enabled: boolean) {
  if (!enabled) return { duration: 0 };
  return {
    duration: 0.18,
    ease: [0.2, 0, 0, 1] as [number, number, number, number],
    layout: {
      duration: 0.22,
      ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
    },
  };
}

const MOBILE_IDENTITY_COLUMNS = [
  "name",
  "title",
  "subject",
  "order_no",
  "email",
  "username",
  "platform",
  "user_id",
  "id",
];

function DefaultMobileCard<
  TData extends Record<string, unknown> & { id?: string | number },
>({ row, detailsLimit }: { row: Row<TData>; detailsLimit?: number }) {
  const { t } = useTranslation("components");
  const cells = row
    .getVisibleCells()
    .filter(
      (cell) => !["actions", "selected", "sortable"].includes(cell.column.id)
    );
  const identity =
    MOBILE_IDENTITY_COLUMNS.map((id) =>
      cells.find((cell) => cell.column.id === id)
    ).find(Boolean) || cells[0];
  const details = cells.filter((cell) => cell.id !== identity?.id);
  const visibleDetails =
    detailsLimit === undefined ? details : details.slice(0, detailsLimit);
  const collapsedDetails =
    detailsLimit === undefined ? [] : details.slice(detailsLimit);
  const renderCell = (cell: (typeof cells)[number]) =>
    flexRender(cell.column.columnDef.cell, cell.getContext()) ??
    String(cell.getValue() ?? "—");

  return (
    <div className="admin-mobile-record">
      {identity ? (
        <div className="admin-mobile-record__identity">
          <span className="admin-mobile-record__label">
            {getMobileColumnLabel(
              identity.column.id,
              identity.column.columnDef.header
            )}
          </span>
          <div className="admin-mobile-record__title">
            {renderCell(identity)}
          </div>
        </div>
      ) : null}
      {visibleDetails.length > 0 ? (
        <dl className="admin-mobile-record__details">
          {visibleDetails.map((cell) => (
            <div className="admin-mobile-record__field" key={cell.id}>
              <dt className="admin-mobile-record__label">
                {getMobileColumnLabel(
                  cell.column.id,
                  cell.column.columnDef.header
                )}
              </dt>
              <dd className="admin-mobile-record__value">{renderCell(cell)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {collapsedDetails.length > 0 ? (
        <Collapsible className="admin-mobile-record__disclosure">
          <CollapsibleTrigger asChild>
            <Button
              className="admin-mobile-record__disclosure-trigger group"
              size="sm"
              variant="ghost"
            >
              <span>{t("table.moreDetails", "More details")}</span>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="admin-mobile-record__details admin-mobile-record__details--collapsed">
              {collapsedDetails.map((cell) => (
                <div className="admin-mobile-record__field" key={cell.id}>
                  <dt className="admin-mobile-record__label">
                    {getMobileColumnLabel(
                      cell.column.id,
                      cell.column.columnDef.header
                    )}
                  </dt>
                  <dd className="admin-mobile-record__value">
                    {renderCell(cell)}
                  </dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

function getMobileColumnLabel(columnId: string, header: unknown) {
  if (typeof header === "string" || typeof header === "number") {
    return header;
  }
  return columnId
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createSelectColumn<TData, TValue>(labels: {
  selectAll: string;
  selectRow: string;
}): ColumnDef<TData, TValue> {
  return {
    id: "selected",
    header: ({ table }) => (
      <Checkbox
        aria-label={labels.selectAll}
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        className="admin-pro-table-selection"
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={labels.selectRow}
        checked={row.getIsSelected()}
        className="admin-pro-table-selection"
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

function RowActions({
  items,
  moreLabel,
  visibleCount = 1,
}: {
  items: React.ReactNode[];
  moreLabel: string;
  visibleCount?: number;
}) {
  const visibleItems = items.filter(Boolean);
  if (visibleItems.length === 0) return null;

  const normalizedVisibleCount = Math.max(1, Math.floor(visibleCount));
  const primary = visibleItems.slice(0, normalizedVisibleCount);
  const secondary = visibleItems.slice(normalizedVisibleCount);

  return (
    <div
      className={cn(
        "flex items-center justify-end",
        primary.length >= 3 ? "gap-0.5" : "gap-1.5"
      )}
    >
      <div className="flex items-center gap-0.5 [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:px-3">
        {primary}
      </div>
      {secondary.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-label={moreLabel}
              size="icon-sm"
              title={moreLabel}
              variant="ghost"
            >
              <MoreHorizontal />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-52 rounded-xl p-1.5 text-center [&_[data-slot=button]]:h-9 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-center [&_[data-slot=button]]:px-3"
            sideOffset={6}
          >
            <div className="grid gap-1">{secondary}</div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function getTableHeaderClass(columnId: string) {
  if (["sortable", "selected"].includes(columnId)) {
    return "sticky left-0 z-10 bg-[color-mix(in_srgb,var(--muted)_45%,var(--card))] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] [&:has([role=checkbox])]:pr-2";
  }
  if (columnId === "actions") {
    return "sticky right-0 z-10 w-[116px] min-w-[116px] bg-[color-mix(in_srgb,var(--muted)_45%,var(--card))] text-right shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  return "truncate";
}

function getTableCellClass(columnId: string) {
  if (["sortable", "selected"].includes(columnId)) {
    return "sticky left-0 bg-card shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  if (columnId === "actions") {
    return "sticky right-0 w-[116px] min-w-[116px] bg-card shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  return "truncate";
}
