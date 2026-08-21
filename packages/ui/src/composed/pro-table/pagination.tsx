import type { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaginationProps<TData> {
  table: Table<TData>;
  total?: number;
}

export function Pagination<TData>({ table, total }: PaginationProps<TData>) {
  const { t } = useTranslation("components");
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageSize = table.getState().pagination.pageSize;
  const start = total ? pageIndex * pageSize + 1 : 0;
  const end = total ? Math.min((pageIndex + 1) * pageSize, total) : 0;

  return (
    <div className="admin-pagination flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <div
        aria-live="polite"
        className="whitespace-nowrap text-muted-foreground text-sm"
      >
        {total !== undefined
          ? t("pagination.rangeInfo", "{{start}}–{{end}} of {{total}}", {
              start,
              end,
              total,
            })
          : t("pagination.pageInfo", "Page {{page}} of {{total}}", {
              page: pageIndex + 1,
              total: pageCount,
            })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <p className="whitespace-nowrap text-muted-foreground text-sm">
            {t("pagination.rowsPerPage", "Rows per page")}
          </p>
          <Select
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
            value={`${table.getState().pagination.pageSize}`}
          >
            <SelectTrigger className="h-8 w-[72px] rounded-lg">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label={t("pagination.previous", "Go to previous page")}
            className="size-8 rounded-full"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-20 text-center font-medium text-sm">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button
            aria-label={t("pagination.next", "Go to next page")}
            className="size-8 rounded-full"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="icon"
            variant="ghost"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
