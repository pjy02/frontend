// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localLogDate } from "./log-filters";
import { LogPage } from "./log-page";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, params?: Record<string, unknown>) =>
      typeof fallback === "string"
        ? fallback.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
            String(params?.[key] ?? key)
          )
        : _key,
    i18n: { language: "en-US" },
  }),
}));
function TestLog() {
  return (
    <LogPage<
      { id: number; name: string },
      {
        start_date?: string;
        end_date?: string;
        user_id?: number;
        search?: string;
      }
    >
      columns={[
        { accessorKey: "name", header: "Name" },
        {
          id: "order",
          header: "Order",
          cell: () => <Link to="/dashboard/order">Open order</Link>,
        },
      ]}
      description="Records"
      filterTypes={{ user_id: "number", search: "string" }}
      load={mocks.load}
      params={[{ key: "user_id", placeholder: "User ID" }]}
      title="Test log"
    />
  );
}
async function mount(query = "") {
  const root = createRootRoute({ component: Outlet });
  const log = createRoute({
    getParentRoute: () => root,
    path: "/dashboard/log/login",
    component: TestLog,
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/dashboard/order",
    component: () => <div>Order page</div>,
  });
  const history = createMemoryHistory({
    initialEntries: [`/dashboard/log/login${query}`],
  });
  const router = createRouter({
    routeTree: root.addChildren([log, detail]),
    history,
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  await screen.findByText("Test log");
  return { history, router };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({
    data: {
      data: {
        list: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Record ${i + 1}`,
        })),
        total: 100,
      },
    },
  });
});
afterEach(cleanup);

describe("LogPage with real table and router", () => {
  it("keeps empty results explicit", async () => {
    mocks.load.mockResolvedValueOnce({
      data: { data: { list: [], total: 0 } },
    });
    await mount();
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        document.querySelector('.admin-pro-table[data-loading="false"]')
      ).toBeTruthy()
    );
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });
  it("shows a retry action after loading fails and restores the records", async () => {
    mocks.load.mockRejectedValueOnce(new Error("Offline"));
    await mount();
    const retry = await screen.findAllByRole("button", { name: "Try again" });
    fireEvent.click(retry[0] as HTMLButtonElement);
    await screen.findAllByText("Record 1");
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("distinguishes a denied request from a retryable failure", async () => {
    mocks.load.mockRejectedValueOnce({ code: 40_005 });
    await mount();
    await screen.findAllByText("You do not have permission to view this data");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
  it("does not leak list filters into a route entered during a pending update", async () => {
    const { history } = await mount(
      "?start_date=2026-09-01&end_date=2026-09-30&user_id=7"
    );
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    act(() => {
      fireEvent.change(screen.getByLabelText("Start date"), {
        target: { value: "2026-09-02" },
      });
      history.push("/dashboard/order?search=ORDER-42");
    });
    await screen.findByText("Order page");
    expect(history.location.href).toBe("/dashboard/order?search=ORDER-42");
  });
  it("requests today and synchronizes legacy links without losing pagination or IDs", async () => {
    const { history } = await mount(
      "?date=2026-09-03&user_id=7&page=4&size=20&subscribe_id=11"
    );
    await waitFor(() =>
      expect(mocks.load).toHaveBeenCalledWith(
        { page: 4, size: 20 },
        { start_date: "2026-09-03", end_date: "2026-09-03", user_id: 7 }
      )
    );
    const search = new URLSearchParams(history.location.search);
    expect(search.has("date")).toBe(false);
    expect(search.get("subscribe_id")).toBe("11");
    expect(search.get("page")).toBe("4");
  });
  it("initializes to today and blocks reversed ranges without fetching", async () => {
    await mount();
    await waitFor(() =>
      expect(mocks.load).toHaveBeenCalledWith(
        { page: 1, size: 10 },
        { start_date: localLogDate(), end_date: localLogDate() }
      )
    );
    mocks.load.mockClear();
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2099-01-01" },
    });
    await screen.findByRole("alert");
    expect(mocks.load).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2099-02-01" },
    });
    await waitFor(() =>
      expect(mocks.load).toHaveBeenCalledWith(
        { page: 1, size: 10 },
        { start_date: "2099-01-01", end_date: "2099-02-01" }
      )
    );
  });
  it("supports one-sided ranges, resets pagination on filters and restores state on back", async () => {
    const { history } = await mount(
      "?start_date=2026-09-01&end_date=2026-09-30&page=3&user_id=7"
    );
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "" },
    });
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 1, size: 10 },
        { end_date: "2026-09-30", user_id: 7 }
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 2, size: 10 },
        { end_date: "2026-09-30", user_id: 7 }
      )
    );
    fireEvent.click(
      screen.getAllByRole("link", {
        name: "Open order",
      })[0] as HTMLAnchorElement
    );
    await screen.findByText("Order page");
    act(() => history.back());
    await screen.findByText("Test log");
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 2, size: 10 },
        { end_date: "2026-09-30", user_id: 7 }
      )
    );
    expect(
      (screen.getByLabelText("Start date") as HTMLInputElement).value
    ).toBe("");
    expect((screen.getByLabelText("End date") as HTMLInputElement).value).toBe(
      "2026-09-30"
    );
    expect((screen.getByLabelText("User ID") as HTMLInputElement).value).toBe(
      "7"
    );
  });
  it("restores an external URL without requesting or writing the previous filters", async () => {
    const { history } = await mount(
      "?start_date=2026-09-01&end_date=2026-09-30&user_id=7&page=3"
    );
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    mocks.load.mockClear();
    act(() =>
      history.push(
        "/dashboard/log/login?start_date=2026-08-01&end_date=2026-08-31&user_id=9&page=2"
      )
    );
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 2, size: 10 },
        { start_date: "2026-08-01", end_date: "2026-08-31", user_id: 9 }
      )
    );
    expect(
      mocks.load.mock.calls.every(
        ([page, filter]) => page.page === 2 && filter.user_id === 9
      )
    ).toBe(true);
    mocks.load.mockClear();
    act(() => history.back());
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 3, size: 10 },
        { start_date: "2026-09-01", end_date: "2026-09-30", user_id: 7 }
      )
    );
    expect(
      mocks.load.mock.calls.every(
        ([page, filter]) => page.page === 3 && filter.user_id === 7
      )
    ).toBe(true);
  });
  it("reset returns to today's range and page one", async () => {
    await mount("?start_date=2026-08-01&user_id=7&page=3");
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Reset table" }));
    await waitFor(() =>
      expect(mocks.load).toHaveBeenLastCalledWith(
        { page: 1, size: 10 },
        { start_date: localLogDate(), end_date: localLogDate() }
      )
    );
  });
});
