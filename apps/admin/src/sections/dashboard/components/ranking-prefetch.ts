/** Bound background reads without changing Query's cache, retries or cancellation. */
export function createRankingPrefetch(limit = 4) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const pump = () => {
    while (active < limit && waiting.length) waiting.shift()?.();
  };
  return <T>(read: () => Promise<T>, signal: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      const abort = () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        signal.removeEventListener("abort", abort);
        reject(new DOMException("Read cancelled", "AbortError"));
      };
      const start = () => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          abort();
          return;
        }
        active++;
        Promise.resolve()
          .then(read)
          .then(resolve, reject)
          .finally(() => {
            active--;
            pump();
          });
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      waiting.push(start);
      pump();
    });
}
