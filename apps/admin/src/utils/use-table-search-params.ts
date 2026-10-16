import { useMatch, useRouter } from "@tanstack/react-router";
import type { ProTablePagination } from "@workspace/ui/composed/pro-table/pro-table";
import { useCallback } from "react";

const PAGE_SIZES = new Set([10, 20, 50, 100]);

type TableSearch = Record<string, unknown>;

// File-based index routes may report a trailing slash while hash history does not.
export function isSameTablePath(left: string, right: string) {
  return (
    (left.replace(/\/+$/, "") || "/") === (right.replace(/\/+$/, "") || "/")
  );
}

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function getTablePagination(search: TableSearch): ProTablePagination {
  const page = parsePositiveInteger(search.page) || 1;
  const requestedSize = parsePositiveInteger(search.size);
  return {
    page,
    size: requestedSize && PAGE_SIZES.has(requestedSize) ? requestedSize : 10,
  };
}

export function useTableSearchWriter() {
  const router = useRouter();
  const ownerPathname = useMatch({
    strict: false,
    select: (match) => match.pathname,
  });

  return useCallback(
    (update: (search: URLSearchParams) => void) => {
      const location = router.history.location;
      // Effects from the previous list may finish after a fast navigation.
      // They must never write its filters into the destination page's URL.
      if (!isSameTablePath(location.pathname, ownerPathname)) return;
      const search = new URLSearchParams(location.search);
      update(search);

      const query = search.toString();
      const nextHref = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
      if (nextHref !== location.href) {
        router.history.replace(nextHref, location.state);
      }
    },
    [router, ownerPathname]
  );
}

export function useTableSearchParams(filterKeys: readonly string[]) {
  const writeSearch = useTableSearchWriter();
  const filterKeysSnapshot = filterKeys.join("|");

  return useCallback(
    (filters: Record<string, unknown>) => {
      const keys = filterKeysSnapshot.split("|").filter(Boolean);
      writeSearch((search) => {
        for (const key of keys) {
          const value = filters[key];
          if (value === null || value === undefined || value === "") {
            search.delete(key);
          } else {
            search.set(key, String(value));
          }
        }
      });
    },
    [filterKeysSnapshot, writeSearch]
  );
}

export function useTablePaginationSearchParams() {
  const writeSearch = useTableSearchWriter();

  return useCallback(
    ({ page, size }: ProTablePagination) => {
      writeSearch((search) => {
        if (page > 1) search.set("page", String(page));
        else search.delete("page");

        if (size !== 10) search.set("size", String(size));
        else search.delete("size");
      });
    },
    [writeSearch]
  );
}
