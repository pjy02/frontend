import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Switch } from "@workspace/ui/components/switch";
import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import { usePreferenceScope } from "@workspace/ui/composed/pro-table/view-preferences";
import { type ReactNode, type RefObject, useId } from "react";
import { useTranslation } from "react-i18next";

/** A write was acknowledged. Retrying this error must ONLY repeat the read. */
export class SavedSyncError extends Error {
  readonly value: boolean;
  constructor(value: boolean) {
    super("Write confirmed; refresh failed");
    this.value = value;
  }
}

export function useRowOperationKey(resource: string, id: string | number) {
  const scope = usePreferenceScope();
  return [
    "admin-row-action",
    scope?.accountKey ?? "session",
    resource,
    String(id),
  ];
}

export async function synchronizeTable(
  action: RefObject<ProTableActions | null>,
  id: string | number
) {
  if (!action.current) throw new Error("Table is not available");
  await action.current.refresh({
    reason: "refresh",
    rowIds: [id],
    throwOnError: true,
  });
}

type Change = { value: boolean; refreshOnly: boolean };

/** Pessimistic controlled switch; MutationCache shares the row lock with hidden/mobile copies.
 * There is no optimistic business value to roll back. A failed write keeps the old value.
 * Confirmed writes with a failed read retain their value and expose a read-only retry. */
export function AsyncSwitch({
  resource,
  id,
  field,
  checked,
  label,
  disabled,
  onWrite,
  onSync,
  status,
  compact = false,
}: {
  resource: string;
  id: string | number;
  field: string;
  checked: boolean;
  label: string;
  disabled?: boolean;
  onWrite: (checked: boolean) => Promise<unknown>;
  onSync: () => Promise<unknown>;
  status?: (checked: boolean) => ReactNode;
  /** Narrow mobile card headers must not size themselves around full error prose. */
  compact?: boolean;
}) {
  const { t } = useTranslation("components");
  const client = useQueryClient();
  // This is in-memory only; neither credentials nor drafts are persisted.
  const key = useRowOperationKey(resource, id);
  const mutationKey = [...key, field];
  const operations = useMutationState({
    filters: { mutationKey: key },
    select: (mutation) => ({
      field: mutation.options.mutationKey?.at(-1),
      status: mutation.state.status,
      error: mutation.state.error,
      variables: mutation.state.variables as Change | undefined,
    }),
  });
  const latest = new Map(
    operations.map((operation) => [operation.field, operation])
  );
  const current = latest.get(field);
  const unsynced = [...latest.values()].some(
    (operation) => operation.error instanceof SavedSyncError
  );
  const pending = operations.some(
    (operation) => operation.status === "pending"
  );
  const savedError =
    current?.error instanceof SavedSyncError
      ? current.error
      : current?.status === "pending" && current.variables?.refreshOnly
        ? { value: current.variables.value }
        : undefined;
  const value = savedError?.value ?? checked;
  const errorId = useId();
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: async ({ value: next, refreshOnly }: Change) => {
      if (!refreshOnly) await onWrite(next);
      try {
        await onSync();
      } catch {
        throw new SavedSyncError(next);
      }
    },
  });
  const run = (next: boolean, refreshOnly = false) => {
    // Read the live cache as well as rendered state: two events can arrive before React commits.
    if (
      client
        .getMutationCache()
        .findAll({ mutationKey: key })
        .some((item) => item.state.status === "pending")
    )
      return;
    if (!refreshOnly && (disabled || unsynced)) return;
    mutation.mutate({ value: next, refreshOnly });
  };
  const error = current?.status === "error" || Boolean(savedError);
  const message = savedError
    ? t(
        "actions.savedSyncFailed",
        "Saved. Refresh failed; do not submit again."
      )
    : t(
        "actions.writeFailed",
        "The change was not confirmed. The previous state is retained; retry when safe."
      );
  return (
    <div
      className={`admin-async-switch grid min-w-0 gap-1.5 ${compact ? "max-w-24" : ""}`}
      data-phase={
        pending
          ? "pending"
          : savedError
            ? "saved-unsynced"
            : error
              ? "failed"
              : "idle"
      }
    >
      <div className="flex items-center gap-2">
        <Switch
          aria-busy={pending || undefined}
          aria-describedby={error ? errorId : undefined}
          aria-label={label}
          checked={value}
          disabled={disabled || pending || unsynced}
          onCheckedChange={(next) => run(next)}
        />
        {status?.(value)}
        {pending && (
          <span className="sr-only" role="status">
            {t("actions.processing", "Processing")}
          </span>
        )}
      </div>
      {error && (
        <div
          className={
            compact ? "grid min-w-0 gap-1 text-xs" : "max-w-60 text-xs"
          }
          id={errorId}
          role="alert"
        >
          {compact ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-label={message}
                  className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left text-xs"
                  size="sm"
                  variant="link"
                >
                  {savedError
                    ? t("actions.savedStale", "Saved · stale")
                    : t("actions.notConfirmed", "Not confirmed")}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="max-w-[calc(100vw-2rem)] p-3 text-sm"
                collisionPadding={8}
              >
                <p>{message}</p>
              </PopoverContent>
            </Popover>
          ) : (
            <p
              className={
                savedError ? "text-muted-foreground" : "text-destructive"
              }
            >
              {message}
            </p>
          )}
          {savedError && (
            <Button
              className={
                compact
                  ? "h-auto min-h-11 justify-start whitespace-normal px-0 text-left text-xs"
                  : undefined
              }
              data-action="retry-refresh"
              disabled={pending}
              loading={pending}
              loadingLabel={t("actions.processing", "Processing")}
              onClick={() => run(savedError.value, true)}
              size="sm"
              variant="link"
            >
              {t("actions.retryRefresh", "Retry refresh")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
