import { describe, expect, it } from "vitest";
import {
  getPageDirection,
  getRowFeedback,
  getRowIdentity,
} from "./data-continuity.js";

describe("pro table data continuity", () => {
  it("keeps stable row identities and detects additions and updates", () => {
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
        ]
      )
    ).toEqual({ 1: "updated", 3: "added" });
  });

  it("derives pagination direction without treating refreshes as navigation", () => {
    expect(getPageDirection(1, 2)).toBe("forward");
    expect(getPageDirection(2, 1)).toBe("backward");
    expect(getPageDirection(2, 2)).toBe("none");
  });
});
