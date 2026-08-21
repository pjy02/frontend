import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell, TableRow } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { GripVertical } from "lucide-react";
import type React from "react";

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  isSortable: boolean;
  className?: string;
}

export function SortableRow({
  id,
  children,
  isSortable,
  className,
  ...props
}: SortableRowProps & React.ComponentProps<typeof TableRow>) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      disabled: !isSortable,
    });

  const style = {
    transform: CSS.Transform.toString({
      x: 0,
      y: transform?.y || 0,
      scaleX: transform?.scaleX || 1,
      scaleY: transform?.scaleY || 1,
    }),
    transition,
  };

  return (
    <TableRow
      className={cn("admin-pro-table-row", className)}
      ref={setNodeRef}
      style={style}
      {...props}
    >
      {isSortable ? (
        <TableCell className="cursor-move" {...listeners} {...attributes}>
          <GripVertical className="h-4 w-4 cursor-move text-gray-500 hover:text-gray-700" />
        </TableCell>
      ) : null}
      {children}
    </TableRow>
  );
}
