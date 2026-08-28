export type RowFeedback = "added" | "updated";
export type PageDirection = "backward" | "forward" | "none";

type IdentifiableRow = { id?: string | number };

export function getRowIdentity(row: IdentifiableRow, index: number) {
  return row.id === undefined || row.id === null
    ? String(index)
    : String(row.id);
}

export function getRowFeedback<TData extends IdentifiableRow>(
  previous: TData[],
  next: TData[]
) {
  const previousById = new Map(
    previous.map((row, index) => [getRowIdentity(row, index), row])
  );
  const feedback: Record<string, RowFeedback> = {};

  next.forEach((row, index) => {
    const id = getRowIdentity(row, index);
    const previousRow = previousById.get(id);
    if (!previousRow) {
      feedback[id] = "added";
      return;
    }
    if (JSON.stringify(previousRow) !== JSON.stringify(row)) {
      feedback[id] = "updated";
    }
  });

  return feedback;
}

export function getPageDirection(
  previousPage: number,
  nextPage: number
): PageDirection {
  if (nextPage === previousPage) return "none";
  return nextPage > previousPage ? "forward" : "backward";
}
