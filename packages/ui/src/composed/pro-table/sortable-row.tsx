import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMotionProfile } from "@workspace/ui/components/motion-profile";
import { TableCell } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { useCallback } from "react";
import { type RowFeedback, rowExit } from "./data-continuity.js";

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  isSortable: boolean;
  className?: string;
  feedback?: RowFeedback;
  motionEnabled: boolean;
  selected: boolean;
  mutationLayout?: boolean;
  ref?: React.Ref<HTMLTableRowElement>;
}

export function SortableRow({
  id,
  children,
  isSortable,
  className,
  feedback,
  motionEnabled,
  selected,
  mutationLayout = false,
  ref,
}: SortableRowProps) {
  const presets = useMotionProfile()?.presets;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      animateLayoutChanges: (args) =>
        mutationLayout && !args.isSorting && !args.wasDragging
          ? args.previousItems.includes(args.id)
          : defaultAnimateLayoutChanges(args),
      disabled: !isSortable,
      transition: presets
        ? {
            duration: presets.dataLayout.durationMs,
            easing: `cubic-bezier(${presets.dataLayout.transition.ease.join(", ")})`,
          }
        : undefined,
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
  const setRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      setNodeRef(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [setNodeRef, ref]
  );

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
      exit="removed"
      initial={motionEnabled && feedback === "added" ? { opacity: 0 } : false}
      ref={setRef}
      style={style}
      transition={
        motionEnabled
          ? (presets?.dataEnter.transition ?? { duration: 0.16 })
          : { duration: 0 }
      }
      variants={{
        removed: rowExit(
          id,
          motionEnabled,
          presets?.dataExit.transition.duration
        ),
      }}
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
