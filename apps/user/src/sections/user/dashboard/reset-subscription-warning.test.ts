import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const content = readProjectFile("./content.tsx");
const english = JSON.parse(
  readProjectFile("../../../../public/assets/locales/en-US/dashboard.json")
) as Record<string, string>;
const chinese = JSON.parse(
  readProjectFile("../../../../public/assets/locales/zh-CN/dashboard.json")
) as Record<string, string>;

describe("reset subscription risk warning", () => {
  it("keeps every risk section connected to both locales", () => {
    for (const key of [
      "resetSubscriptionTitle",
      "resetSubscriptionDescription",
      "resetSubscriptionSteps",
      "resetSubscriptionUnaffected",
    ]) {
      expect(content).toContain(`"${key}"`);
      expect(english[key]?.trim()).not.toBe("");
      expect(chinese[key]?.trim()).not.toBe("");
    }
  });

  it("states the breakage, required recovery, and unaffected account data", () => {
    expect(english.resetSubscriptionDescription).toContain("stops working");
    expect(english.resetSubscriptionSteps).toContain("delete the old");
    expect(english.resetSubscriptionUnaffected).toContain("not affected");

    expect(chinese.resetSubscriptionDescription).toContain("失效");
    expect(chinese.resetSubscriptionSteps).toContain("删除旧订阅");
    expect(chinese.resetSubscriptionUnaffected).toContain("不受影响");
  });
});
