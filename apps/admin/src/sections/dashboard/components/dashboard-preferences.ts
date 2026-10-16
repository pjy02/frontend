import { usePreferenceScope } from "@workspace/ui/composed/pro-table/view-preferences";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { useStoredPreference } from "@workspace/ui/hooks/use-stored-preference";

export const DASHBOARD_PREFERENCES_STORAGE_KEY =
  "ppanel.admin.dashboard.preferences.v2";
export const DASHBOARD_MODULES = [
  "income",
  "newUsers",
  "onlineUsers",
  "monthTraffic",
  "trafficRanking",
  "revenueTrend",
  "userTrend",
  "systemHealth",
  "servers",
  "pending",
  "systemServices",
  "systemOperations",
  "projectSupport",
] as const;
export type DashboardModuleId = (typeof DASHBOARD_MODULES)[number];
export type DashboardLayout = {
  order: DashboardModuleId[];
  hidden: DashboardModuleId[];
};
export type DashboardPreferences = {
  desktop: DashboardLayout;
  mobile: DashboardLayout;
};
export type DashboardPreset =
  | "default"
  | "operations"
  | "infrastructure"
  | "minimal";
export function dashboardPreset(preset: DashboardPreset): DashboardLayout {
  const visible: readonly DashboardModuleId[] =
    preset === "operations"
      ? [
          "income",
          "newUsers",
          "onlineUsers",
          "monthTraffic",
          "trafficRanking",
          "revenueTrend",
          "userTrend",
          "pending",
        ]
      : preset === "infrastructure"
        ? [
            "onlineUsers",
            "monthTraffic",
            "systemHealth",
            "servers",
            "trafficRanking",
            "pending",
            "systemServices",
            "systemOperations",
          ]
        : preset === "minimal"
          ? [
              "income",
              "newUsers",
              "onlineUsers",
              "monthTraffic",
              "trafficRanking",
              "pending",
            ]
          : DASHBOARD_MODULES.filter((id) => id !== "projectSupport");
  return {
    order: [
      ...visible,
      ...DASHBOARD_MODULES.filter((id) => !visible.includes(id)),
    ],
    hidden: DASHBOARD_MODULES.filter((id) => !visible.includes(id)),
  };
}
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  desktop: dashboardPreset("default"),
  mobile: dashboardPreset("default"),
};
const isModule = (value: unknown): value is DashboardModuleId =>
  DASHBOARD_MODULES.includes(value as DashboardModuleId);
function parseLayout(value: unknown): DashboardLayout {
  if (!value || typeof value !== "object") return dashboardPreset("default");
  const candidate = value as Partial<DashboardLayout>;
  const order = Array.isArray(candidate.order)
    ? [...new Set(candidate.order.filter(isModule))]
    : [];
  return {
    order: [...order, ...DASHBOARD_MODULES.filter((id) => !order.includes(id))],
    hidden: Array.isArray(candidate.hidden)
      ? [...new Set(candidate.hidden.filter(isModule))]
      : ["projectSupport"],
  };
}
export function parseDashboardPreferences(
  raw: string | null
): DashboardPreferences {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object")
      return DEFAULT_DASHBOARD_PREFERENCES;
    return {
      desktop: parseLayout(value.desktop),
      mobile: parseLayout(value.mobile),
    };
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}
export function moveDashboardModule(
  layout: DashboardLayout,
  id: DashboardModuleId,
  offset: number
): DashboardLayout {
  const order = [...layout.order];
  const index = order.indexOf(id);
  const next = index + offset;
  if (index < 0 || next < 0 || next >= order.length) return layout;
  [order[index], order[next]] = [order[next]!, order[index]!];
  return { ...layout, order };
}
export function useDashboardPreferences() {
  const scope = usePreferenceScope();
  const mobile = useIsMobile();
  const [preferences, setPreferences, unavailable] = useStoredPreference(
    scope?.accountKey
      ? `${DASHBOARD_PREFERENCES_STORAGE_KEY}.${encodeURIComponent(scope.accountKey)}`
      : null,
    parseDashboardPreferences
  );
  const device: keyof DashboardPreferences = mobile ? "mobile" : "desktop";
  return {
    preferences,
    device,
    layout: preferences[device],
    unavailable,
    ready: Boolean(scope?.accountKey),
    updateLayout: (
      target: keyof DashboardPreferences,
      update: (layout: DashboardLayout) => DashboardLayout
    ) =>
      setPreferences((current) => ({
        ...current,
        [target]: update(current[target]),
      })),
  };
}
