import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

export type StatusChipTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface StatusChipProps extends React.ComponentProps<"span"> {
  tone?: StatusChipTone;
  dot?: boolean;
}

export function StatusChip({
  tone = "neutral",
  dot = true,
  className,
  ...props
}: StatusChipProps) {
  return (
    <span
      className={cn("admin-status-chip", className)}
      data-dot={dot}
      data-tone={tone}
      {...props}
    />
  );
}
