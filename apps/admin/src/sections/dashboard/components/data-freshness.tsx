import type { QueryObserverResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export type FreshnessQuery = Pick<
  QueryObserverResult,
  "data" | "dataUpdatedAt" | "isError" | "isFetching"
>;

export function freshnessState(query: FreshnessQuery) {
  if (query.data == null)
    return query.isError
      ? "unavailable"
      : query.isFetching
        ? "loading"
        : "empty";
  return query.isError ? "stale" : query.isFetching ? "refreshing" : "ready";
}

/** refetch() can resolve with an error result rather than reject. */
export async function refreshDashboardSources(
  sources: { refetch: () => Promise<{ isError: boolean; data?: unknown }> }[]
) {
  const results = await Promise.allSettled(
    sources.map((source) => Promise.resolve().then(() => source.refetch()))
  );
  const failed = results.filter(
    (result) =>
      result.status === "rejected" ||
      result.value.isError ||
      result.value.data == null
  ).length;
  return { failed, total: sources.length };
}

export function DataFreshness({
  query,
  label,
}: {
  query: FreshnessQuery;
  label?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const state = freshnessState(query);
  const time =
    query.dataUpdatedAt > 0
      ? new Date(query.dataUpdatedAt).toLocaleString(i18n?.language)
      : null;
  const text =
    state === "stale"
      ? t("freshness.stale", "Refresh failed · showing previous data")
      : state === "unavailable"
        ? t("freshness.unavailable", "Unable to load data")
        : state === "empty"
          ? t("freshness.empty", "No data received")
          : state === "loading"
            ? t("freshness.loading", "Loading data…")
            : state === "refreshing"
              ? t("freshness.refreshing", "Refreshing · showing previous data")
              : t("freshness.updated", "Updated");
  return (
    <p
      className={`min-h-5 text-xs ${state === "stale" || state === "unavailable" ? "text-[var(--admin-warning)]" : "text-muted-foreground"}`}
      data-freshness={state}
    >
      {label && <span>{label}: </span>}
      {text}
      {time && (
        <span>
          {" "}
          ·{" "}
          <time dateTime={new Date(query.dataUpdatedAt).toISOString()}>
            {time}
          </time>
        </span>
      )}
    </p>
  );
}
