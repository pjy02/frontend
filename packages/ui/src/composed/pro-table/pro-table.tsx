"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import { SortableRow } from "@workspace/ui/composed/pro-table/sortable-row";
import { ProTableWrapper } from "@workspace/ui/composed/pro-table/wrapper";
import { cn } from "@workspace/ui/lib/utils";
import {
  GripVertical,
  MoreHorizontal,
  ShieldX,
  TriangleAlert,
} from "lucide-react";
import type React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
  };
  mobile?: {
    render: (row: TData) => React.ReactNode;
    getAriaLabel?: (row: TData) => string;
  };
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
  initialFilters?: Record<string, unknown>;
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
  initialFilters,
  mobile,
}: ProTableProps<TData, TValue>) {
  const { t } = useTranslation("components");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    if (initialFilters) {
      return Object.entries(initialFilters).map(([id, value]) => ({
        id,
        value,
      })) as ColumnFiltersState;
    }
    return [];
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [data, setData] = useState<TData[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const requestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const adminMotionEnabled =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("admin-console");
  const [fetchError, setFetchError] = useState<"error" | "forbidden" | null>(
    null
  );

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
      ...(actions?.batchRender ? [createSelectColumn<TData, TValue>()] : []),
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
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
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

  const fetchData = async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setFetchError(null);
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
        setData(response.list);
        setRowCount(response.total);
        setDataVersion((version) => version + 1);
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
        setData([]);
        setRowCount(0);
        setFetchError(code === 403 || code === 40_005 ? "forbidden" : "error");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };
  const reset = async () => {
    table.resetSorting();
    table.resetColumnFilters();
    table.resetGlobalFilter(true);
    table.resetColumnVisibility();
    table.resetRowSelection();
    table.resetPagination();
  };
  useImperativeHandle(action, () => ({
    refresh: fetchData,
    reset,
  }));

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    JSON.stringify(columnFilters),
  ]);

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
    >
      {!header?.hidden && (
        <DataToolbar
          filters={Object.fromEntries(
            columnFilters.map((item) => [item.id, item.value])
          )}
          labels={{
            columns: texts?.columns || t("table.columns", "Choose columns"),
            refresh: texts?.refresh || t("table.refresh", "Refresh data"),
            reset: texts?.reset || t("table.reset", "Reset table"),
          }}
          loading={isLoading}
          mobileCards={Boolean(mobile)}
          onRefresh={fetchData}
          onReset={reset}
          params={params}
          table={table}
          title={header?.title}
          toolbar={header?.toolbar}
        />
      )}

      {selectedCount > 0 && actions?.batchRender && (
        <Alert className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertTitle className="m-0">
            {texts?.selectedRowsText?.(selectedCount) ||
              `Selected ${selectedCount} rows`}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap justify-end gap-2">
            {actions.batchRender(selectedRows)}
          </AlertDescription>
        </Alert>
      )}

      {mobile ? (
        <div
          className="admin-pro-table-mobile grid gap-3 md:hidden"
          key={adminMotionEnabled ? `mobile-${dataVersion}` : undefined}
        >
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const rowActions = actions?.render?.(row.original) || [];
              return (
                <article
                  aria-label={mobile.getAriaLabel?.(row.original)}
                  className="admin-pro-table-card overflow-hidden rounded-xl border bg-card"
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                >
                  <div className="p-4">{mobile.render(row.original)}</div>
                  {(actions?.batchRender || rowActions.length > 0) && (
                    <div className="flex min-h-12 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
                      {actions?.batchRender ? (
                        <Checkbox
                          aria-label={t("table.selectRow", "Select row")}
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) =>
                            row.toggleSelected(!!value)
                          }
                        />
                      ) : (
                        <span />
                      )}
                      <RowActions
                        items={rowActions}
                        moreLabel={
                          texts?.moreActions ||
                          t("table.moreActions", "More actions")
                        }
                      />
                    </div>
                  )}
                </article>
              );
            })
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
                <Button onClick={fetchData} size="sm" variant="outline">
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
      ) : null}

      <div
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border bg-card",
          mobile && "hidden md:block"
        )}
      >
        <div aria-hidden="true" className="admin-pro-table-progress" />
        <ProTableWrapper data={data} onSort={onSort} setData={setData}>
          <Table className="w-full">
            <TableHeader className="bg-muted/45">
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
            <TableBody key={adminMotionEnabled ? dataVersion : undefined}>
              {table.getRowModel()?.rows?.length ? (
                onSort ? (
                  table.getRowModel().rows.map((row) => (
                    <SortableRow
                      className="h-13"
                      data-state={row.getIsSelected() && "selected"}
                      id={
                        row.original.id
                          ? String(row.original.id)
                          : String(row.index)
                      }
                      isSortable
                      key={
                        row.original.id
                          ? String(row.original.id)
                          : String(row.index)
                      }
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
                  ))
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      className="admin-pro-table-row h-13"
                      data-state={row.getIsSelected() && "selected"}
                      key={row.id}
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
                    </TableRow>
                  ))
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
                        <Button onClick={fetchData} size="sm" variant="outline">
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
      {rowCount > 0 && <Pagination table={table} total={rowCount} />}
    </div>
  );
}

function createSelectColumn<TData, TValue>(): ColumnDef<TData, TValue> {
  return {
    id: "selected",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
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
}: {
  items: React.ReactNode[];
  moreLabel: string;
}) {
  const visibleItems = items.filter(Boolean);
  if (visibleItems.length === 0) return null;

  const [primary, ...secondary] = visibleItems;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <div className="[&_[data-slot=button]]:h-8 [&_[data-slot=button]]:px-3">
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
            className="w-52 rounded-xl p-1.5 [&_[data-slot=button]]:h-9 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-start [&_[data-slot=button]]:px-3"
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
    return "sticky left-0 z-10 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] [&:has([role=checkbox])]:pr-2";
  }
  if (columnId === "actions") {
    return "sticky right-0 z-10 w-[116px] min-w-[116px] text-right bg-background shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  return "truncate";
}

function getTableCellClass(columnId: string) {
  if (["sortable", "selected"].includes(columnId)) {
    return "sticky left-0 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  if (columnId === "actions") {
    return "sticky right-0 w-[116px] min-w-[116px] bg-background shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]";
  }
  return "truncate";
}
