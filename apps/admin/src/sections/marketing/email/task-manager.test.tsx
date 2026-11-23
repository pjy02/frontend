// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailContentPreview, EmailRecipientCount } from "./task-manager";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (_key: string, fallback: string) => fallback,
  }),
}));
afterEach(cleanup);

it("removes remote media before rendering while preserving inline images and style", () => {
  render(
    <EmailContentPreview
      html={
        '<p style="color:navy">Message</p><img src="https://example.test/remote.png" alt="Remote"><img src="data:image/gif;base64,AA==" alt="Inline">'
      }
      title="Email preview"
    />
  );
  const frame = screen.getByTitle("Email preview");
  const markup = frame.getAttribute("srcdoc");
  expect(frame.getAttribute("sandbox")).toBe("");
  expect(markup).toContain('style="color:navy"');
  expect(markup).toContain("data:image/gif;base64,AA==");
  expect(markup).not.toContain("https://example.test/remote.png");
});

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
