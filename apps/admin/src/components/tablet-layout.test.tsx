// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { ProTable } from "@workspace/ui/composed/pro-table/pro-table";
import { TablePreferencesProvider } from "@workspace/ui/composed/pro-table/view-preferences";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));
afterEach(cleanup);
const columns = [{ accessorKey: "name", header: "Name" }];
const request = async () => ({ list: [{ id: 1, name: "One" }], total: 1 });

it("does not opt shared non-Admin tables into tablet styling", async () => {
  const { container } = render(
    <ProTable columns={columns} request={request} tablet="grid" />
  );
  await waitFor(() => expect(container.textContent).toContain("One"));
  expect(container.querySelector("[data-tablet-layout]")).toBeNull();
});

it.each([
  [undefined, false, "list"],
  ["grid", false, "grid"],
  ["grid", true, "list"],
] as const)("chooses %s with sortable=%s as %s", async (tablet, sortable, expected) => {
  const { container } = render(
    <TablePreferencesProvider value={{ accountKey: null, pageKey: "test" }}>
      <ProTable
        columns={columns}
        onSort={sortable ? async (_source, _target, items) => items : undefined}
        request={request}
        tablet={tablet}
      />
    </TablePreferencesProvider>
  );
  await waitFor(() => expect(container.textContent).toContain("One"));
  expect(
    container
      .querySelector(".admin-pro-table")
      ?.getAttribute("data-tablet-layout")
  ).toBe(expected);
});

it("respects explicit table-only pages", () => {
  const { container } = render(
    <TablePreferencesProvider value={{ accountKey: "1", pageKey: "test" }}>
      <ProTable
        columns={columns}
        mobile={false}
        request={request}
        tablet="grid"
      />
    </TablePreferencesProvider>
  );
  expect(container.querySelector("[data-tablet-layout]")).toBeNull();
  expect(container.querySelector(".admin-pro-table-mobile")).toBeNull();
});
