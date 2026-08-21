import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { formatBytes } from "@workspace/ui/utils/formatting";
import { Eye } from "lucide-react";
import type * as React from "react";
import { StatusChip, type StatusChipTone } from "@/components/status-chip";
import {
  WorkspaceDialog,
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";

export function LogTypeChip({ children }: { children: React.ReactNode }) {
  return (
    <StatusChip dot={false} tone="neutral">
      {children}
    </StatusChip>
  );
}

const statusTones: Record<string, StatusChipTone> = {
  success: "success",
  error: "danger",
  pending: "warning",
  neutral: "neutral",
};

export function LogStatusChip({
  status,
  children,
}: {
  status: keyof typeof statusTones;
  children: React.ReactNode;
}) {
  return <StatusChip tone={statusTones[status]}>{children}</StatusChip>;
}

export function TrafficValue({ value }: { value?: number | null }) {
  return (
    <span className="font-medium tabular-nums">{formatBytes(value ?? 0)}</span>
  );
}

export function UserAgentValue({ value }: { value?: string | null }) {
  const normalizedValue = value || "—";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-56 cursor-help truncate text-sm">
            {normalizedValue}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="wrap-break-word max-w-md">{normalizedValue}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatPayload(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function LogPayloadValue({
  value,
  title,
  description,
  viewLabel,
}: {
  value: unknown;
  title: React.ReactNode;
  description: React.ReactNode;
  viewLabel: React.ReactNode;
}) {
  const payload = formatPayload(value);
  return (
    <WorkspaceDialog>
      <WorkspaceDialogTrigger asChild>
        <Button className="max-w-52 justify-start" size="sm" variant="ghost">
          <Eye className="shrink-0" />
          <span className="truncate">{viewLabel}</span>
        </Button>
      </WorkspaceDialogTrigger>
      <WorkspaceDialogContent size="lg">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>{title}</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>{description}</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody>
          <pre className="wrap-break-word min-h-40 whitespace-pre-wrap rounded-xl border bg-muted/45 p-4 font-mono text-xs leading-5">
            {payload}
          </pre>
        </WorkspaceDialogBody>
      </WorkspaceDialogContent>
    </WorkspaceDialog>
  );
}
