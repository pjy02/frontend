// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminActionLogPage from "./admin";
import UnmatchedPaymentLogPage, {
  formatUnmatchedAmount,
} from "./payment-unmatched";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  unmatched: vi.fn(),
  props: {} as Record<string, any>,
  row: {} as Record<string, unknown>,
}));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  getLogAdminList: mocks.admin,
  getLogPaymentUnmatchedList: mocks.unmatched,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/sections/user/user-detail", () => ({
  UserDetail: ({ id }: { id: number }) => <span>User #{id}</span>,
}));
vi.mock("@/components/commerce-display", () => ({
  DateTimeValue: ({ value }: { value: number }) => <span>{value}</span>,
}));
vi.mock("@/components/order-link", () => ({
  OrderLink: ({ orderId }: { orderId: string }) => (
    <a href={`/dashboard/order?search=${orderId}`}>{orderId}</a>
  ),
}));
vi.mock("@/sections/log/components/log-page", () => ({
  LogPage: (props: Record<string, any>) => {
    mocks.props = props;
    return (
      <>
        {props.title}
        {props.columns.map((column: Record<string, any>) => (
          <section key={column.id || column.accessorKey}>
            <h3>{column.header}</h3>
            {column.cell
              ? column.cell({ row: { original: mocks.row } })
              : String(mocks.row[column.accessorKey] || "—")}
          </section>
        ))}
      </>
    );
  },
}));
vi.mock("@/sections/log/request-source", () => ({
  RequestSource: ({ metadata }: { metadata: { actor_id?: number } }) => (
    <span>Actor #{metadata.actor_id}</span>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("new log pages", () => {
  it("shows administrator, action, object, source, detail and time in a shared log page", () => {
    mocks.row = {
      id: 1,
      user_id: 7,
      action: "system.update",
      object: "system",
      object_id: 42,
      source: "admin",
      detail: "Changed DNS settings",
      timestamp: 1234,
    };
    render(<AdminActionLogPage />);
    for (const text of [
      "User #7",
      "system.update",
      "system · #42",
      "admin",
      "Actor #7",
      "1234",
    ])
      expect(screen.getByText(text)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(screen.getByText("Changed DNS settings")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    const pagination = { page: 3, size: 20 };
    const filters = {
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      user_id: 7,
      search: "system",
    };
    mocks.props.load(pagination, filters);
    expect(mocks.admin).toHaveBeenCalledWith({ ...pagination, ...filters });
    const mobile = mocks.props.mobile.render(mocks.row);
    cleanup();
    render(mobile);
    expect(screen.getByText("system.update")).toBeTruthy();
    expect(screen.getByText("User #7")).toBeTruthy();
  });
  it("provides order lookup and reason details but no executable refund", () => {
    mocks.row = {
      id: 2,
      user_id: 7,
      order_no: "ORDER-42",
      trade_no: "TRADE-123456",
      platform: "stripe",
      amount: 12_500,
      currency: "EUR",
      reason: "Order already canceled",
      timestamp: 1234,
    };
    render(<UnmatchedPaymentLogPage />);
    for (const text of [
      "User #7",
      "TRADE-123456",
      "stripe",
      "125.00 EUR",
      "EUR",
      "1234",
    ])
      expect(screen.getByText(text)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "ORDER-42" }).getAttribute("href")
    ).toBe("/dashboard/order?search=ORDER-42");
    expect(screen.queryByRole("button", { name: /refund/i })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Order already canceled" })
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    const pagination = { page: 2, size: 50 };
    const filters = { end_date: "2026-09-30", user_id: 7, search: "ORDER-42" };
    mocks.props.load(pagination, filters);
    expect(mocks.unmatched).toHaveBeenCalledWith({ ...pagination, ...filters });
    const mobile = mocks.props.mobile.render(mocks.row);
    cleanup();
    render(mobile);
    expect(screen.getByText("125.00 EUR")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ORDER-42" })).toBeTruthy();
  });
  it("displays the recorded currency, zero amounts and missing currency safely", () => {
    expect(formatUnmatchedAmount(0, "USD", "en-US")).toBe("0.00 USD");
    expect(formatUnmatchedAmount(123_456, " eur ", "en-US")).toBe(
      "1,234.56 EUR"
    );
    expect(formatUnmatchedAmount(100, "", "zh-CN")).toBe("1.00 —");
    expect(formatUnmatchedAmount(Number.NaN, "USD", "en-US")).toBe("—");
  });
});
