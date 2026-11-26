import { getCommonSiteConfig as getGlobalConfig } from "@workspace/ui/services/common/common";

let initialConfigPromise: ReturnType<typeof getGlobalConfig> | undefined;

// Called from main.tsx at module scope so the config request runs in parallel
// with translation loading instead of waiting for the first React commit.
// The root route awaits the same promise.
export function fetchInitialConfig(): ReturnType<typeof getGlobalConfig> {
  if (!initialConfigPromise) {
    const request = getGlobalConfig();
    initialConfigPromise = request;
    // The root route attaches its own handlers later; swallow the rejection
    // here to avoid an unhandled-rejection warning in the meantime, and
    // clear the cached promise so retries can re-fetch.
    request.catch(() => {
      if (initialConfigPromise === request) {
        initialConfigPromise = undefined;
      }
    });
  }
  return initialConfigPromise;
}
