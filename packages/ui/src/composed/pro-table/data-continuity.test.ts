import { describe, expect, it } from "vitest";
import {
  getPageDirection,
  getRowFeedback,
  getRowIdentity,
  resolveTableOperation,
  rowExit,
} from "./data-continuity.js";

describe("pro table data continuity", () => {
  it("keeps stable row identities and only highlights explicit business mutations", () => {
    expect(getRowIdentity({ id: 7 }, 0)).toBe("7");
    expect(getRowIdentity({}, 3)).toBe("3");
    expect(
      getRowFeedback(
        [
          { id: 1, name: "Tokyo" },
          { id: 2, name: "Singapore" },
        ],
        [
          { id: 1, name: "Tokyo updated" },
          { id: 3, name: "Frankfurt" },
        ],
        { reason: "edit", rowIds: [1] }
      )
    ).toEqual({ 1: "updated" });
    expect(
      getRowFeedback([{ id: 1 }], [{ id: 3 }], {
        reason: "create",
        rowIds: [3],
      })
    ).toEqual({ 3: "added" });
  });

  it.each([
    "initial",
    "refresh",
    "filter",
    "pagination",
    "sort",
    "delete",
  ] as const)("does not label %s results as new/updated", (reason) => {
    expect(getRowFeedback([{ id: 1 }], [{ id: 2 }], { reason })).toEqual({});
  });

  it("ignores unrelated updates, ambiguous additions and index-only identities", () => {
    expect(
      getRowFeedback(
        [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
        ],
        [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
        ],
        { reason: "edit", rowIds: [2] }
      )
    ).toEqual({ 2: "updated" });
    expect(
      getRowFeedback([], [{ id: 1 }, { id: 2 }], { reason: "create" })
    ).toEqual({});
    expect(getRowFeedback([], [{}], { reason: "create" })).toEqual({});
  });

  it("query changes override mutation intent; only matching deletions exit", () => {
    expect(
      resolveTableOperation(undefined, "{}\n0:10", { reason: "create" })
    ).toBe("initial");
    expect(
      resolveTableOperation("{}\n0:10", "{}\n1:10", { reason: "create" })
    ).toBe("pagination");
    expect(
      resolveTableOperation("{}\n0:10", '{"search":"a"}\n0:10', {
        reason: "edit",
      })
    ).toBe("filter");
    expect(
      resolveTableOperation("{}\n0:10", "{}\n0:10", { reason: "edit" })
    ).toBe("edit");
    expect(
      rowExit("1", true)({ reason: "pagination" }).transition.duration
    ).toBe(0);
    expect(rowExit("1", true)({ reason: "delete", rowIds: [2] }).opacity).toBe(
      1
    );
    expect(rowExit("1", true)({ reason: "delete", rowIds: [1] }).opacity).toBe(
      0
    );
    expect(
      rowExit("1", false)({ reason: "delete", rowIds: [1] }).transition.duration
    ).toBe(0);
  });

  it("derives pagination direction without treating refreshes as navigation", () => {
    expect(getPageDirection(1, 2)).toBe("forward");
    expect(getPageDirection(2, 1)).toBe("backward");
    expect(getPageDirection(2, 2)).toBe("none");
  });
});
