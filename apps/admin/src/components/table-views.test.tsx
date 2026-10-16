// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ProTable } from "@workspace/ui/composed/pro-table/pro-table";
import {
  TablePreferencesProvider,
  tablePreferenceStorageKey,
} from "@workspace/ui/composed/pro-table/view-preferences";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => values?.[key] || key),
  }),
}));
vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "note", header: "Note" },
];
const params = [{ key: "search", placeholder: "Search records" }];
const saved = {
  density: "compact",
  visibility: { note: false },
  views: [
    {
      id: "one",
      name: "Offline",
      density: "compact",
      visibility: { note: false },
      filters: { search: "offline" },
    },
  ],
};
const request = async () => ({
  list: [{ id: 1, name: "One", note: "Note" }],
  total: 1,
});
const table = (
  account = "1",
  pageKey = "/dashboard/user",
  onFiltersChange = vi.fn()
) => (
  <TablePreferencesProvider value={{ accountKey: account, pageKey }}>
    <ProTable
      columns={columns}
      mobile={false}
      onFiltersChange={onFiltersChange}
      params={params}
      request={request}
    />
  </TablePreferencesProvider>
);
const seed = () =>
  localStorage.setItem(
    tablePreferenceStorageKey("1", "/dashboard/user", "name|note"),
    JSON.stringify(saved)
  );
describe("saved table views", () => {
  it("persists column visibility and density and keeps them when filters are reset", async () => {
    const changed = vi.fn();
    const view = render(table("1", "/dashboard/user", changed));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Choose columns" }),
      { button: 0, ctrlKey: false }
    );
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Note" })
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.change(screen.getByPlaceholderText("Search records"), {
      target: { value: "offline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith({}));
    expect(
      view.container
        .querySelector(".admin-pro-table")
        ?.getAttribute("data-density")
    ).toBe("compact");
    view.unmount();
    const next = render(table());
    expect(
      next.container
        .querySelector(".admin-pro-table")
        ?.getAttribute("data-density")
    ).toBe("compact");
    expect(screen.queryByRole("columnheader", { name: "Note" })).toBeNull();
  });
  it("saves, applies and updates a view and keeps saved views when defaults are restored", async () => {
    const changed = vi.fn();
    const view = render(table("1", "/dashboard/user", changed));
    fireEvent.change(screen.getByPlaceholderText("Search records"), {
      target: { value: "offline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    fireEvent.change(screen.getByRole("textbox", { name: "View name" }), {
      target: { value: "Offline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current view" }));
    expect(await screen.findByRole("button", { name: "Offline" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Restore table defaults" })
    );
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith({}));
    expect(
      view.container
        .querySelector(".admin-pro-table")
        ?.getAttribute("data-density")
    ).toBe("comfortable");
    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    await waitFor(() =>
      expect(changed).toHaveBeenLastCalledWith({ search: "offline" })
    );
  });
  it("isolates stored views between accounts and pages", () => {
    seed();
    const view = render(table());
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    expect(screen.getByRole("button", { name: "Offline" })).toBeTruthy();
    view.rerender(table("2"));
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    expect(screen.queryByRole("button", { name: "Offline" })).toBeNull();
    view.rerender(table("1", "/dashboard/servers"));
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    expect(screen.queryByRole("button", { name: "Offline" })).toBeNull();
  });
  it("does not silently save a view after stripping a subscription token filter", () => {
    render(
      <TablePreferencesProvider
        value={{ accountKey: "1", pageKey: "/dashboard/user" }}
      >
        <ProTable
          columns={columns}
          initialFilters={{ user_subscribe_token: "private-token" }}
          mobile={false}
          params={[{ key: "user_subscribe_token" }]}
          request={request}
        />
      </TablePreferencesProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Table views" }));
    fireEvent.change(screen.getByRole("textbox", { name: "View name" }), {
      target: { value: "Private" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Save current view",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(localStorage.length).toBe(0);
  });
  it("does not add preference controls to User Web without an Admin provider", async () => {
    render(<ProTable columns={columns} mobile={false} request={request} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset table" })).toBeTruthy()
    );
    expect(screen.queryByRole("button", { name: "Table views" })).toBeNull();
  });
});
