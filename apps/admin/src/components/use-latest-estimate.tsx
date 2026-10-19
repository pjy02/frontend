import { Button } from "@workspace/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Debounce + request identity. Obsolete requests never publish results or errors. */
export function useLatestEstimate<T>(
  key: string,
  enabled: boolean,
  calculate: () => Promise<T>
) {
  const latest = useRef({ key, enabled, calculate });
  latest.current = { key, enabled, calculate };
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: boolean;
    pending: boolean;
  }>({ key, pending: true });
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setState({ key, pending: true });
    const timer = setTimeout(async () => {
      try {
        const data = await latest.current.calculate();
        if (current && latest.current.key === key && latest.current.enabled)
          setState({ key, data, pending: false });
      } catch {
        if (current && latest.current.key === key && latest.current.enabled)
          setState({ key, error: true, pending: false });
      }
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, enabled, attempt]);
  const matches = state.key === key;
  return {
    data: matches ? state.data : undefined,
    error: matches && Boolean(state.error),
    pending: enabled && (!matches || state.pending),
    retry: () => setAttempt((value) => value + 1),
  };
}

export function EstimateStatus({
  error,
  retry,
}: {
  error: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation("components");
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="status">
      {error
        ? t("read.estimateFailed", "Unable to calculate at the moment")
        : t("read.calculating", "Calculating…")}
      {error && (
        <Button onClick={retry} size="sm" type="button" variant="link">
          {t("read.retry", "Retry")}
        </Button>
      )}
    </span>
  );
}
