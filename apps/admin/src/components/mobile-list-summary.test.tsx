// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileListSummary } from "./mobile-list-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

afterEach(cleanup);

describe("MobileListSummary", () => {
  it("keeps secondary fields collapsed until requested", () => {
    render(
      <MobileListSummary
        details={[{ label: "Callback URL", value: "https://example.com" }]}
        fields={[{ label: "Amount", value: "$12.00" }]}
        title="Payment method"
      />
    );

    expect(screen.getByText("$12.00")).toBeTruthy();
    expect(screen.queryByText("https://example.com")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More details" }));

    expect(screen.getByText("https://example.com")).toBeTruthy();
  });
});
