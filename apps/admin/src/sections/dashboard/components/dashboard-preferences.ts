import { useCallback, useEffect, useState } from "react";

export const DASHBOARD_PREFERENCES_STORAGE_KEY =
  "ppanel.admin.dashboard.preferences.v1";

export type DashboardPreferences = {
  projectSupport: boolean;
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  projectSupport: false,
};

export function parseDashboardPreferences(
  value: string | null
): DashboardPreferences {
  if (!value) return DEFAULT_DASHBOARD_PREFERENCES;

  try {
    const stored = JSON.parse(value) as Partial<DashboardPreferences>;
    return {
      projectSupport:
        typeof stored.projectSupport === "boolean"
          ? stored.projectSupport
          : DEFAULT_DASHBOARD_PREFERENCES.projectSupport,
    };
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

function readDashboardPreferences(): DashboardPreferences {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_PREFERENCES;

  try {
    return parseDashboardPreferences(
      window.localStorage.getItem(DASHBOARD_PREFERENCES_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(
    readDashboardPreferences
  );

  const setProjectSupportVisible = useCallback((visible: boolean) => {
    setPreferences((current) => {
      const next = { ...current, projectSupport: visible };
      try {
        window.localStorage.setItem(
          DASHBOARD_PREFERENCES_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // The preference remains active for this session if storage is blocked.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const syncPreferences = (event: StorageEvent) => {
      if (event.key === DASHBOARD_PREFERENCES_STORAGE_KEY) {
        setPreferences(parseDashboardPreferences(event.newValue));
      }
    };
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  return { preferences, setProjectSupportVisible };
}
