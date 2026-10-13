// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketPage from "./index";

const mocks = vi.hoisted(() => ({ reply: vi.fn(), refetch: vi.fn() }));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  postTicketFollow: mocks.reply,
  getTicketDetail: vi.fn(),
  getTicketList: vi.fn(),
  putTicket: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ enabled }: { enabled: boolean }) => ({
    data: enabled
      ? { id: 1, title: "Support", status: 1, follow: [] }
      : undefined,
    refetch: mocks.refetch,
  }),
}));
vi.mock("@workspace/ui/composed/pro-table/pro-table", () => ({
  ProTable: ({
    actions,
  }: {
    actions: { render: (row: { id: number; status: number }) => ReactNode };
  }) => <div>{actions.render({ id: 1, status: 1 })}</div>,
}));
vi.mock("@workspace/ui/components/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@workspace/ui/composed/icon", () => ({ Icon: () => null }));
vi.mock("@workspace/ui/composed/confirm-button", () => ({
  ConfirmButton: () => null,
}));
vi.mock("@/components/admin-action-menu", () => ({
  AdminActionMenu: () => null,
  AdminActionMenuDangerItem: () => null,
}));
vi.mock("../user/user-detail", () => ({ UserDetail: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

beforeEach(() => {
  mocks.reply.mockReset().mockResolvedValue({ data: { code: 200 } });
  mocks.refetch.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

function openReply() {
  render(<TicketPage />);
  fireEvent.click(screen.getByRole("button", { name: "Reply" }));
  return screen.getByPlaceholderText(
    "Please enter your question, we will reply as soon as possible."
  ) as HTMLInputElement;
}

describe("admin ticket replies", () => {
  it("rejects an oversized reply before making a request", async () => {
    const input = openReply();
    fireEvent.change(input, { target: { value: "a".repeat(65_536) } });
    fireEvent.submit(input.form!);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.reply).not.toHaveBeenCalled();
  });

  it("retains a failed reply and retries with the same content", async () => {
    mocks.reply.mockRejectedValueOnce(new Error("request failed"));
    const input = openReply();
    fireEvent.change(input, { target: { value: "Please check this order." } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Send reply",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    expect(input.value).toBe("Please check this order.");
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(mocks.reply).toHaveBeenCalledTimes(2));
    expect(mocks.reply).toHaveBeenLastCalledWith({
      ticket_id: 1,
      from: "System",
      type: 1,
      content: "Please check this order.",
    });
    await waitFor(() => expect(input.value).toBe(""));
  });
});
