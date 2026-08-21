"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ListTodoIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ColumnToggleProps<TData> {
  table: Table<TData>;
  title?: string;
}

export function ColumnToggle<TData>({
  table,
  title,
}: ColumnToggleProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={title || "Choose columns"}
          className="size-8"
          size="icon"
          title={title || "Choose columns"}
          variant="ghost"
        >
          <ListTodoIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide()
          )
          .map((column) => {
            const columns = table
              .getAllColumns()
              .filter((item) => item.getIsVisible());
            return (
              <DropdownMenuCheckboxItem
                checked={column.getIsVisible()}
                className="capitalize"
                disabled={
                  columns.length === 1 && columns?.[0]?.id === column.id
                }
                key={column.id}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.columnDef.header as ReactNode}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
