import { useCallback, useEffect, useState } from "react";

/** A null key is session-only, e.g. while the administrator is loading. */
export function useStoredPreference<T>(
  key: string | null,
  parse: (raw: string | null) => T
) {
  const read = useCallback(() => {
    try {
      return parse(key ? localStorage.getItem(key) : null);
    } catch {
      return parse(null);
    }
  }, [key, parse]);
  const [snapshot, setSnapshot] = useState(() => ({
    key,
    value: read(),
    unavailable: false,
  }));
  let current = snapshot;
  if (snapshot.key !== key) {
    current = { key, value: read(), unavailable: false };
    setSnapshot(current);
  }
  const update = useCallback(
    (next: T | ((value: T) => T)) => {
      setSnapshot((previous) => {
        const value =
          typeof next === "function"
            ? (next as (value: T) => T)(
                previous.key === key ? previous.value : read()
              )
            : next;
        let unavailable = false;
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            unavailable = true;
          }
        }
        return { key, value, unavailable };
      });
    },
    [key, read]
  );
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (key && (event.key === key || event.key === null))
        setSnapshot({ key, value: read(), unavailable: false });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, read]);
  return [current.value, update, current.unavailable] as const;
}
