// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailRecipientCount } from "./task-manager";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (_key: string, fallback: string) => fallback,
  }),
}));
afterEach(cleanup);

describe("email recipient count", () => {
  it("displays the backend total rather than counting a truncated recipient list", () => {
    const task = {
      recipient_count: 1234,
      recipients: "first@example.com\n...",
    };
    render(<EmailRecipientCount value={task.recipient_count} />);
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("preserves zero and shows an unknown total for an older backend", () => {
    const view = render(<EmailRecipientCount value={0} />);
    expect(screen.getByText("0")).toBeTruthy();
    view.rerender(<EmailRecipientCount />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
