import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import type { RowFeedback } from "./data-continuity.js";

interface SortableMobileCardProps {
  id: string;
  children: React.ReactNode;
  dragLabel: string;
  footerEnd?: React.ReactNode;
  footerStart?: React.ReactNode;
  label: string;
  selected?: boolean;
  feedback?: RowFeedback;
  motionEnabled: boolean;
}

export function SortableMobileCard({
  id,
  children,
  dragLabel,
  feedback,
  footerEnd,
  footerStart,
  label,
  motionEnabled,
  selected,
}: SortableMobileCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(
      transform
        ? {
            ...transform,
            x: 0,
          }
        : null
    ),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <motion.article
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-label={label}
      className={cn(
        "admin-pro-table-card relative overflow-hidden rounded-xl border bg-card",
        isDragging &&
          "border-primary/40 shadow-lg ring-2 ring-primary/15 motion-reduce:shadow-none"
      )}
      data-dragging={isDragging || undefined}
      data-feedback={feedback}
      data-state={selected ? "selected" : undefined}
      exit={motionEnabled ? { opacity: 0, scale: 0.99, y: -4 } : undefined}
      initial={motionEnabled ? { opacity: 0, scale: 0.99, y: 4 } : false}
      layout={motionEnabled && !isDragging ? "position" : false}
      ref={setNodeRef}
      style={style}
      transition={{
        duration: motionEnabled ? 0.18 : 0,
        layout: {
          duration: motionEnabled ? 0.22 : 0,
          ease: [0.2, 0.8, 0.2, 1],
        },
      }}
    >
      <div className="p-4">{children}</div>
      <div className="flex min-h-12 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            {...attributes}
            {...listeners}
            aria-label={dragLabel}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing active:bg-accent"
            ref={setActivatorNodeRef}
            size="sm"
            title={dragLabel}
            type="button"
            variant="ghost"
          >
            <GripVertical />
            <span>{dragLabel}</span>
          </Button>
          {footerStart}
        </div>
        {footerEnd}
      </div>
    </motion.article>
  );
}
