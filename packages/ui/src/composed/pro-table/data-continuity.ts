export type RowFeedback = "added" | "updated";
export type PageDirection = "backward" | "forward" | "none";
export type TableOperation =
  | "initial"
  | "refresh"
  | "filter"
  | "pagination"
  | "sort"
  | "create"
  | "edit"
  | "delete";

/** Mutation feedback is opt-in; query results are not business events. */
export interface TableRefreshOptions {
  reason?: TableOperation;
  rowIds?: readonly (string | number)[];
}

export function resolveTableOperation(
  previous: string | undefined,
  query: string,
  options: TableRefreshOptions
): TableOperation {
  if (previous === undefined) return "initial";
  if (previous !== query) {
    return previous.split("\n")[0] !== query.split("\n")[0]
      ? "filter"
      : "pagination";
  }
  return options.reason || "refresh";
}

export function rowExit(id: string, enabled: boolean, duration = 0.12) {
  return (operation?: TableRefreshOptions) => ({
    opacity:
      enabled &&
      operation?.reason === "delete" &&
      operation.rowIds?.some((rowId) => String(rowId) === id)
        ? 0
        : 1,
    transition: {
      duration:
        enabled &&
        operation?.reason === "delete" &&
        operation.rowIds?.some((rowId) => String(rowId) === id)
          ? duration
          : 0,
    },
  });
}

type IdentifiableRow = { id?: string | number };

export function getRowIdentity(row: IdentifiableRow, index: number) {
  return row.id === undefined || row.id === null
    ? String(index)
    : String(row.id);
}

export function getRowFeedback<TData extends IdentifiableRow>(
  previous: TData[],
  next: TData[],
  operation: TableRefreshOptions = {}
) {
  if (operation.reason !== "create" && operation.reason !== "edit") return {};
  const previousById = new Map(
    previous.filter((row) => row.id != null).map((row) => [String(row.id), row])
  );
  const feedback: Record<string, RowFeedback> = {};

  next.forEach((row) => {
    if (row.id == null) return;
    const id = String(row.id);
    if (
      operation.rowIds &&
      !operation.rowIds.some((value) => String(value) === id)
    )
      return;
    const previousRow = previousById.get(id);
    if (!previousRow && operation.reason === "create") {
      feedback[id] = "added";
      return;
    }
    if (
      previousRow &&
      operation.reason === "edit" &&
      JSON.stringify(previousRow) !== JSON.stringify(row)
    ) {
      feedback[id] = "updated";
    }
  });

  // Without an ID from the mutation, only an unambiguous single change is safe.
  return operation.rowIds || Object.keys(feedback).length === 1 ? feedback : {};
}

export function getPageDirection(
  previousPage: number,
  nextPage: number
): PageDirection {
  if (nextPage === previousPage) return "none";
  return nextPage > previousPage ? "forward" : "backward";
}
