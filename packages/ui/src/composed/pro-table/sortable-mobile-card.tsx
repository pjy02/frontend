import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@workspace/ui/components/button";
import { useMotionProfile } from "@workspace/ui/components/motion-profile";
import { cn } from "@workspace/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import { useCallback } from "react";
import { type RowFeedback, rowExit } from "./data-continuity.js";

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
  mutationLayout?: boolean;
  ref?: React.Ref<HTMLElement>;
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
  mutationLayout = false,
  ref,
}: SortableMobileCardProps) {
  const presets = useMotionProfile()?.presets;
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges: (args) =>
      mutationLayout && !args.isSorting && !args.wasDragging
        ? args.previousItems.includes(args.id)
        : defaultAnimateLayoutChanges(args),
    transition: presets
      ? {
          duration: presets.dataLayout.durationMs,
          easing: `cubic-bezier(${presets.dataLayout.transition.ease.join(", ")})`,
        }
      : undefined,
  });

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
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [setNodeRef, ref]
  );

  return (
    <motion.article
      // DndKit owns the outer transform. Motion position/scale animations on
      // this same node overwrite drag transforms and invalidate measurements.
      animate={{ opacity: 1 }}
      aria-label={label}
      className={cn(
        "admin-pro-table-card relative overflow-hidden rounded-xl border bg-card",
        isDragging &&
          "border-primary/40 shadow-lg ring-2 ring-primary/15 motion-reduce:shadow-none"
      )}
      data-dragging={isDragging || undefined}
      data-feedback={feedback}
      data-state={selected ? "selected" : undefined}
      exit="removed"
      initial={motionEnabled && feedback === "added" ? { opacity: 0 } : false}
      ref={setRef}
      style={style}
      transition={
        motionEnabled
          ? (presets?.dataEnter.transition ?? { duration: 0.18 })
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
      <div className="admin-pro-table-card__body p-4">{children}</div>
      <div className="admin-pro-table-card__footer flex min-h-12 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
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
