// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProtocolFields } from "./useProtocolFields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe("fingerprint field placement", () => {
  it.each([
    "vmess",
    "vless",
    "trojan",
    "anytls",
  ] as const)("shows a single security fingerprint selector for %s", (type) => {
    const { result } = renderHook(() => useProtocolFields());
    expect(result.current[type]).toBeDefined();
    const fields = (result.current[type] ?? []).filter(
      (field) => field.name === "fingerprint"
    );
    expect(fields).toHaveLength(1);
    const field = fields[0]!;
    expect(field.group).toBe("security");
    expect(field.condition?.({ security: "tls" }, {})).toBe(true);
    expect(field.condition?.({ security: "reality" }, {})).toBe(true);
    expect(field.condition?.({ security: "none" }, {})).toBe(false);
  });
});
