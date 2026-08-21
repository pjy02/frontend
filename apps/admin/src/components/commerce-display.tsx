import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";
import { Display } from "@/components/display";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";
import { formatDate } from "@/utils/common";

interface MoneyValueProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  value?: number | null;
  emphasis?: "default" | "strong" | "muted";
}

export function MoneyValue({
  value,
  emphasis = "default",
  className,
  ...props
}: MoneyValueProps) {
  return (
    <span
      className={cn("admin-money-value", className)}
      data-emphasis={emphasis}
      {...props}
    >
      <Display type="currency" value={value} />
    </span>
  );
}

interface DateTimeValueProps
  extends Omit<React.ComponentProps<"time">, "children" | "dateTime"> {
  value?: Date | number | null;
  showTime?: boolean;
  empty?: React.ReactNode;
}

export function DateTimeValue({
  value,
  showTime = true,
  empty = "—",
  className,
  ...props
}: DateTimeValueProps) {
  if (!value) {
    return <span className="admin-time-value">{empty}</span>;
  }

  const formatted = formatDate(value, showTime);
  const date = value instanceof Date ? value : new Date(value);
  const dateTime = Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString();

  if (!formatted) {
    return <span className="admin-time-value">{empty}</span>;
  }

  return (
    <time
      className={cn("admin-time-value", className)}
      dateTime={dateTime}
      {...props}
    >
      {formatted}
    </time>
  );
}

const orderStatusTones: Record<number, StatusChipTone> = {
  1: "warning",
  2: "success",
  3: "neutral",
  4: "danger",
  5: "success",
};

export function OrderStatusChip({
  status,
  label,
}: {
  status: number;
  label: React.ReactNode;
}) {
  return (
    <StatusChip tone={orderStatusTones[status] ?? "neutral"}>
      {label}
    </StatusChip>
  );
}

const ticketStatusTones: Record<number, StatusChipTone> = {
  1: "danger",
  2: "warning",
  3: "success",
  4: "neutral",
};

export function TicketStatusChip({
  status,
  label,
}: {
  status: number;
  label: React.ReactNode;
}) {
  return (
    <StatusChip tone={ticketStatusTones[status] ?? "neutral"}>
      {label}
    </StatusChip>
  );
}

export function EnabledStatusChip({
  enabled,
  enabledLabel,
  disabledLabel,
}: {
  enabled: boolean;
  enabledLabel: React.ReactNode;
  disabledLabel: React.ReactNode;
}) {
  return (
    <StatusChip dot={false} tone={enabled ? "success" : "neutral"}>
      {enabled ? enabledLabel : disabledLabel}
    </StatusChip>
  );
}
