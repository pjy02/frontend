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
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  mobile?:
    | {
        render?: (row: TData) => React.ReactNode;
        getAriaLabel?: (row: TData) => string;
      }
    | false;
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
  const mobileCardsEnabled = mobile !== false;
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
          mobileCards={mobileCardsEnabled}
          onRefresh={fetchData}
          onReset={reset}
          params={params}
          table={table}
          title={header?.title}
          toolbar={header?.toolbar}
        />
      )}

      {selectedCount > 0 &&
        actions?.batchRender &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center sm:inset-x-6 sm:bottom-[max(1rem,env(safe-area-inset-bottom))]">
            <div
              aria-label={t("table.batchActions", "Batch actions")}
              className="admin-batch-actions pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-popover/95 p-2 pl-3 text-popover-foreground shadow-xl backdrop-blur-md sm:justify-start"
              role="toolbar"
            >
              <span aria-live="polite" className="shrink-0 font-medium text-sm">
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
          </div>,
          document.body
        )}

      {mobileCardsEnabled ? (
        <div
          className="admin-pro-table-mobile grid gap-3 lg:hidden"
          key={adminMotionEnabled ? `mobile-${dataVersion}` : undefined}
        >
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const rowActions = actions?.render?.(row.original) || [];
              return (
                <article
                  aria-label={
                    mobile?.getAriaLabel
                      ? mobile.getAriaLabel(row.original)
                      : t("table.recordLabel", "Record {{number}}", {
                          number: row.index + 1,
                        })
                  }
                  className="admin-pro-table-card overflow-hidden rounded-xl border bg-card"
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                >
                  <div className="p-4">
                    {mobile?.render ? (
                      mobile.render(row.original)
                    ) : (
                      <DefaultMobileCard row={row} />
                    )}
                  </div>
                  {(actions?.batchRender || rowActions.length > 0) && (
                    <div className="flex min-h-12 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
                      {actions?.batchRender ? (
                        <Checkbox
                          aria-label={t("table.selectRow", "Select row")}
                          checked={row.getIsSelected()}
                          className="admin-pro-table-selection"
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
          mobileCardsEnabled && "hidden lg:block"
        )}
      >
        <div aria-hidden="true" className="admin-pro-table-progress" />
        <ProTableWrapper data={data} onSort={onSort} setData={setData}>
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
>({ row }: { row: Row<TData> }) {
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
      {details.length > 0 ? (
        <dl className="admin-mobile-record__details">
          {details.map((cell) => (
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
