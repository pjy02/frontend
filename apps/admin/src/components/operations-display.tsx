import type * as React from "react";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";

const taskStatusTones: Record<number, StatusChipTone> = {
  0: "neutral",
  1: "info",
  2: "success",
  3: "danger",
};

export function TaskStatusChip({
  status,
  label,
}: {
  status: number;
  label: React.ReactNode;
}) {
  return (
    <StatusChip tone={taskStatusTones[status] ?? "warning"}>{label}</StatusChip>
  );
}
