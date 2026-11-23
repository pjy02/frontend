const FRESH_FOR_MS = 30_000;

export function createInventoryCache<T>(
  load: (signal: AbortSignal) => Promise<T[]>,
  update: {
    loading: () => void;
    success: (items: T[]) => void;
    failure: () => void;
  }
) {
  let snapshot: { items: T[]; expiresAt: number } | undefined;
  let active: { controller: AbortController; result: Promise<T[]> } | undefined;
  let latest: typeof active;

  return async (options: { refresh?: boolean; signal?: AbortSignal } = {}) => {
    const { refresh, signal } = options;
    signal?.throwIfAborted();
    if (!(refresh || active) && snapshot && snapshot.expiresAt > Date.now()) {
      return snapshot.items;
    }

    if (refresh || !active) {
      const previous = active;
      const controller = new AbortController();
      const result = load(controller.signal).then(
        (items) => {
          if (latest && latest.controller !== controller) return latest.result;
          snapshot = { items, expiresAt: Date.now() + FRESH_FOR_MS };
          active = undefined;
          update.success(items);
          return items;
        },
        (error: unknown) => {
          if (latest && latest.controller !== controller) return latest.result;
          snapshot = undefined;
          active = undefined;
          update.failure();
          throw error;
        }
      );
      active = { controller, result };
      latest = active;
      previous?.controller.abort();
      update.loading();
    }

    // Aborting a table query must not cancel the fetch shared with the dropdown.
    const items = await active.result;
    signal?.throwIfAborted();
    return items;
  };
}
