import { describe, expect, it } from "vitest";
import { generateRealityShortId } from "./short-id";
import { generatePassword } from "./uid";

describe("server cryptographic generators", () => {
  it("generates even-length lowercase hex Reality short IDs between 2 and 16 chars", () => {
    const validLengths = new Set([2, 4, 6, 8, 10, 12, 14, 16]);
    for (let i = 0; i < 64; i++) {
      const shortId = generateRealityShortId();
      expect(validLengths.has(shortId.length)).toBe(true);
      expect(shortId).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("generates passwords of the requested length from the expected charset", () => {
    const defaultPwd = generatePassword();
    expect(defaultPwd).toHaveLength(16);
    expect(defaultPwd).toMatch(/^[a-z0-9]{16}$/);

    const customPwd = generatePassword(24, "ABCDEF012345");
    expect(customPwd).toHaveLength(24);
    expect(customPwd).toMatch(/^[ABCDEF012345]{24}$/);

    expect(generatePassword(0)).toBe("");
  });
});
