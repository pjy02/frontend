export type LogDateRange = { start_date?: string; end_date?: string };
export type LogFilterTypes = Record<string, "number" | "string">;

export function localLogDate(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getLogInitialFilters(
  search: Record<string, unknown>,
  types: LogFilterTypes,
  today = localLogDate()
) {
  const hasRange =
    Object.hasOwn(search, "start_date") || Object.hasOwn(search, "end_date");
  const date =
    typeof search.date === "string" && search.date ? search.date : today;
  const range = hasRange
    ? { start_date: search.start_date, end_date: search.end_date }
    : { start_date: date, end_date: date };
  return Object.fromEntries(
    Object.entries({
      ...types,
      start_date: "string",
      end_date: "string",
    }).flatMap<[string, string | number]>(([key, type]) => {
      if (key === "date") return [];
      const raw =
        key === "start_date" || key === "end_date" ? range[key] : search[key];
      if (raw === undefined || raw === null || raw === "") return [];
      if (type === "number") {
        const number = Number(raw);
        return Number.isSafeInteger(number) && number >= 0
          ? [[key, number]]
          : [];
      }
      return [[key, String(raw)]];
    })
  );
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateLogRange(
  range: LogDateRange
): "invalid" | "reversed" | undefined {
  const { start_date: start, end_date: end } = range;
  if ((start && !isDate(start)) || (end && !isDate(end))) return "invalid";
  if (start && end && start > end) return "reversed";
}

export function writeLogFilters(
  search: URLSearchParams,
  keys: readonly string[],
  filters: Record<string, unknown>
) {
  search.delete("date");
  for (const key of keys) {
    if (key === "date") continue;
    const value = filters[key];
    if (value === undefined || value === null || value === "") {
      // Explicit empty endpoints distinguish an open range from a new visit (today).
      if (key === "start_date" || key === "end_date") search.set(key, "");
      else search.delete(key);
    } else search.set(key, String(value));
  }
}
