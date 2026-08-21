import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import {
  CircleAlert,
  FileQuestion,
  Inbox,
  RefreshCcw,
  ShieldX,
} from "lucide-react";
import type * as React from "react";

interface StateProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: StateProps) {
  return (
    <div className={cn("admin-state", className)} {...props}>
      <div aria-hidden="true" className="admin-state__icon">
        <Inbox className="size-5" />
      </div>
      <h2 className="admin-state__title">{title}</h2>
      {description ? (
        <p className="admin-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

interface ErrorStateProps extends Omit<StateProps, "action"> {
  retryLabel?: React.ReactNode;
  onRetry?: () => void;
  action?: React.ReactNode;
}

export function ErrorState({
  title,
  description,
  retryLabel = "Retry",
  onRetry,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn("admin-state admin-state--error", className)}
      role="alert"
      {...props}
    >
      <div aria-hidden="true" className="admin-state__icon">
        <CircleAlert className="size-5" />
      </div>
      <h2 className="admin-state__title">{title}</h2>
      {description ? (
        <p className="admin-state__description">{description}</p>
      ) : null}
      {action ??
        (onRetry ? (
          <Button onClick={onRetry} size="sm" variant="outline">
            <RefreshCcw className="size-4" />
            {retryLabel}
          </Button>
        ) : null)}
    </div>
  );
}

export function PermissionDeniedState({
  title,
  description,
  action,
  className,
  ...props
}: StateProps) {
  return (
    <div
      className={cn("admin-state admin-state--permission", className)}
      role="alert"
      {...props}
    >
      <div aria-hidden="true" className="admin-state__icon">
        <ShieldX className="size-5" />
      </div>
      <h2 className="admin-state__title">{title}</h2>
      {description ? (
        <p className="admin-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function NotFoundState({
  title,
  description,
  action,
  className,
  ...props
}: StateProps) {
  return (
    <div className={cn("admin-state", className)} {...props}>
      <div aria-hidden="true" className="admin-state__icon">
        <FileQuestion className="size-5" />
      </div>
      <h2 className="admin-state__title">{title}</h2>
      {description ? (
        <p className="admin-state__description">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

interface LoadingStateProps extends React.ComponentProps<"output"> {
  rows?: number;
  compact?: boolean;
  label?: string;
}

export function LoadingState({
  rows = 5,
  compact = false,
  label = "Loading",
  className,
  ...props
}: LoadingStateProps) {
  return (
    <output
      aria-busy="true"
      aria-label={label}
      className={cn("admin-loading-state", className)}
      {...props}
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          className={cn("w-full", compact ? "h-8" : "h-11")}
          key={`loading-row-${index + 1}`}
        />
      ))}
    </output>
  );
}
