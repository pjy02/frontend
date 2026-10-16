import type { VisibilityState } from "@tanstack/react-table";
import { createContext, useContext } from "react";

export const TablePreferencesContext = createContext<{
  accountKey: string | null;
  pageKey: string;
} | null>(null);
export const TablePreferencesProvider = TablePreferencesContext.Provider;
export const usePreferenceScope = () => useContext(TablePreferencesContext);
export const tablePreferenceStorageKey = (
  account: string,
  page: string,
  table: string
) =>
  `ppanel.admin.table.v1.${encodeURIComponent(account)}.${encodeURIComponent(page)}.${encodeURIComponent(table)}`;
export type TableDensity = "comfortable" | "compact";
export type SavedTableView = {
  id: string;
  name: string;
  filters: Record<string, string | number | boolean>;
  visibility: VisibilityState;
  density: TableDensity;
};
export type TablePreferences = {
  visibility: VisibilityState;
  density: TableDensity;
  views: SavedTableView[];
};
export function parseVisibility(value: unknown): VisibilityState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([id, visible]) =>
          ![
            "select",
            "sortable",
            "actions",
            "__proto__",
            "constructor",
            "prototype",
          ].includes(id) && typeof visible === "boolean"
      )
      .slice(0, 100)
  );
}
export function safeViewFilters(
  value: unknown
): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          !/password|secret|token|credential|authorization|__proto__|constructor|prototype/i.test(
            key
          ) &&
          ((typeof item === "string" && item.length <= 256) ||
            (typeof item === "number" && Number.isFinite(item)) ||
            typeof item === "boolean")
      )
      .slice(0, 40)
  );
}
export function parseTablePreferences(raw: string | null): TablePreferences {
  let value: Partial<TablePreferences> = {};
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") value = parsed;
  } catch {
    /* Ignore corrupt preferences. */
  }
  return {
    visibility: parseVisibility(value.visibility),
    density: value.density === "compact" ? "compact" : "comfortable",
    views: Array.isArray(value.views)
      ? value.views
          .filter(
            (v) => v && typeof v.id === "string" && typeof v.name === "string"
          )
          .slice(0, 10)
          .map((v) => ({
            id: v.id.slice(0, 80),
            name: v.name.slice(0, 60),
            filters: safeViewFilters(v.filters),
            visibility: parseVisibility(v.visibility),
            density: v.density === "compact" ? "compact" : "comfortable",
          }))
      : [],
  };
}
