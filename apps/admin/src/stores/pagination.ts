const PAGE_SIZE = 100;

type PaginatedListFetcher<T> = (
  params: {
    page: number;
    size: number;
  },
  options?: { signal?: AbortSignal }
) => Promise<{
  data?: {
    data?: {
      list?: T[];
      total?: number;
    };
  };
}>;

export const fetchAllPaginated = async <T extends { id: number }>(
  fetchPage: PaginatedListFetcher<T>,
  signal?: AbortSignal
): Promise<T[]> => {
  signal?.throwIfAborted();
  const firstResponse = await fetchPage(
    { page: 1, size: PAGE_SIZE },
    { signal }
  );
  const firstPage = firstResponse.data?.data;
  const firstList = firstPage?.list || [];
  const total = firstPage?.total ?? firstList.length;
  if (total <= firstList.length) {
    return firstList;
  }

  // Some backend versions cap a page below the requested size.
  const totalPages = Math.ceil(total / (firstList.length || PAGE_SIZE));
  const items = new Map(firstList.map((item) => [item.id, item]));
  const batchSize = 4;
  for (let page = 2; page <= totalPages; page += batchSize) {
    signal?.throwIfAborted();
    const responses = await Promise.all(
      Array.from(
        { length: Math.min(batchSize, totalPages - page + 1) },
        (_, index) =>
          fetchPage({ page: page + index, size: PAGE_SIZE }, { signal })
      )
    );
    for (const response of responses) {
      for (const item of response.data?.data?.list || []) {
        items.set(item.id, item);
      }
    }
    if (items.size >= total) break;
  }
  return [...items.values()];
};
