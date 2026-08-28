import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import type { RowFeedback } from "./data-continuity.js";

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  isSortable: boolean;
  className?: string;
  feedback?: RowFeedback;
  motionEnabled: boolean;
  selected: boolean;
}

export function SortableRow({
  id,
  children,
  isSortable,
  className,
  feedback,
  motionEnabled,
  selected,
}: SortableRowProps) {
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
    <motion.tr
      animate={{ opacity: 1 }}
      className={cn(
        "admin-pro-table-row border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      data-feedback={feedback}
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      exit={motionEnabled ? { opacity: 0 } : undefined}
      initial={motionEnabled ? { opacity: 0 } : false}
      ref={setNodeRef}
      style={style}
      transition={{ duration: motionEnabled ? 0.16 : 0 }}
    >
      {isSortable ? (
        <TableCell className="cursor-move" {...listeners} {...attributes}>
          <GripVertical className="h-4 w-4 cursor-move text-gray-500 hover:text-gray-700" />
        </TableCell>
      ) : null}
      {children}
    </motion.tr>
  );
}
