import { Button } from "@workspace/ui/components/button";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingState } from "./states";

const readFallbacks = {
  loading: "Loading data",
  failed: "Unable to load data",
  failedDescription: "No data has been loaded. Retry before editing or saving.",
  stale: "Refresh failed. Showing previously loaded data.",
  refreshing: "Refreshing; current content is retained",
  retry: "Retry",
  unconfigured:
    "Not configured yet. Complete the fields below to configure it.",
  empty: "No data available",
  emptyDescription: "No records were returned. You can refresh to check again.",
};

export interface ReadSnapshot {
  data: unknown;
  isError?: boolean;
  isFetching?: boolean;
  refetch: () => Promise<unknown>;
}

/** null is a verified empty response; undefined has never been read successfully. */
export function readReady(query: Pick<ReadSnapshot, "data">) {
  return query.data !== undefined;
}

/** A missing payload is a contract/read failure, never an empty configuration. */
export function requireReadData<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("The response did not contain data");
  return value;
}

export function ReadBoundary({
  query,
  children,
  configuration = false,
  empty = false,
}: {
  query: ReadSnapshot;
  children: ReactNode;
  configuration?: boolean;
  empty?: boolean;
}) {
  const { t } = useTranslation("components");
  const r = (key: keyof typeof readFallbacks) =>
    t(`read.${key}`, readFallbacks[key]);
  const ready = readReady(query);
  const retry = (
    <Button
      loading={query.isFetching}
      loadingLabel={r("refreshing")}
      onClick={() =>
        query.refetch().catch(() => {
          /* The query owns its error state. */
        })
      }
      size="sm"
      type="button"
      variant="outline"
    >
      {r("retry")}
    </Button>
  );
  return (
    <div
      aria-busy={query.isFetching || undefined}
      className="admin-read-boundary"
      data-read-phase={
        ready
          ? query.isError
            ? "stale"
            : query.isFetching
              ? "refreshing"
              : "ready"
          : query.isError
            ? "error"
            : "loading"
      }
    >
      {ready ? (
        <>
          <div aria-live="polite" className="admin-read-notice">
            {query.isError ? (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                role="status"
              >
                <span>{r("stale")}</span>
                {retry}
              </div>
            ) : query.isFetching ? (
              <span role="status">{r("refreshing")}</span>
            ) : configuration &&
              (query.data === null ||
                (Array.isArray(query.data) && query.data.length === 0)) ? (
              <span>{r("unconfigured")}</span>
            ) : null}
          </div>
          {empty || (!configuration && query.data === null) ? (
            <EmptyState
              action={retry}
              description={r("emptyDescription")}
              title={r("empty")}
            />
          ) : (
            <div className="admin-read-content">{children}</div>
          )}
        </>
      ) : query.isError ? (
        <ErrorState
          action={retry}
          description={r("failedDescription")}
          title={r("failed")}
        />
      ) : (
        <LoadingState label={r("loading")} rows={5} />
      )}
    </div>
  );
}
