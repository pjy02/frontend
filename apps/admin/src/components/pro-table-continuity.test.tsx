// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));
afterEach(cleanup);
const columns = [{ accessorKey: "name", header: "Name" }];
const action = () => ({ current: null as ProTableActions | null });
const desktopRows = (container: HTMLElement) =>
  container.querySelectorAll("tbody tr[data-slot='table-row']");

describe("table operation continuity", () => {
  it("skips unchanged closed action subtrees but adopts a replacement action callback", async () => {
    const ref = action();
    const renderAction = vi.fn();
    const firstClick = vi.fn(),
      latestClick = vi.fn();
    function Action({ click }: { click: () => void }) {
      renderAction();
      return (
        <button onClick={click} type="button">
          Action
        </button>
      );
    }
    const actions = {
      render: () => [<Action click={firstClick} key="action" />],
    };
    render(
      <MotionProvider>
        <ProTable
          action={ref}
          actions={actions}
          columns={columns}
          request={async () => ({ list: [{ id: 1, name: "One" }], total: 1 })}
        />
      </MotionProvider>
    );
    await screen.findAllByText("One");
    const count = renderAction.mock.calls.length;
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(renderAction).toHaveBeenCalledTimes(count);
    actions.render = () => [<Action click={latestClick} key="action" />];
    await act(async () => {
      await ref.current?.refresh();
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Action" })[0]!);
    expect(firstClick).not.toHaveBeenCalled();
    expect(latestClick).toHaveBeenCalledOnce();
  });
  it("shares unchanged Admin row identities while still applying fresh changed fields", async () => {
    const ref = action();
    let list = [
      { id: 1, name: "One" },
      { id: 2, name: "Two" },
    ];
    const seen = new Map<number, unknown>();
    render(
      <MotionProvider>
        <ProTable
          action={ref}
          columns={[
            {
              accessorKey: "name",
              header: "Name",
              cell: ({ row }) => {
                seen.set(row.original.id, row.original);
                return row.original.name;
              },
            },
          ]}
          request={async () => ({
            list: structuredClone(list),
            total: list.length,
          })}
        />
      </MotionProvider>
    );
    await screen.findAllByText("One");
    const first = seen.get(1),
      second = seen.get(2);
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(seen.get(1)).toBe(first);
    expect(seen.get(2)).toBe(second);
    list = [
      { id: 1, name: "One" },
      { id: 2, name: "Fresh server value" },
    ];
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(seen.get(1)).toBe(first);
    expect(seen.get(2)).not.toBe(second);
    expect(screen.getAllByText("Fresh server value").length).toBeGreaterThan(0);
  });
  it("keeps result/row DOM on refresh, then only marks the edited/created record", async () => {
    const ref = action();
    let list = [
      { id: 1, name: "One" },
      { id: 2, name: "Two" },
    ];
    const view = render(
      <ProTable
        action={ref}
        columns={columns}
        request={async () => ({ list, total: list.length })}
      />
    );
    await screen.findAllByText("One");
    const body = view.container.querySelector("tbody");
    const row = desktopRows(view.container)[0];
    list = [
      { id: 1, name: "ONE" },
      { id: 2, name: "TWO" },
    ];
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(view.container.querySelector("tbody")).toBe(body);
    expect(desktopRows(view.container)[0]).toBe(row);
    expect(view.container.querySelectorAll("[data-feedback]")).toHaveLength(0);
    list = [
      { id: 1, name: "Edited" },
      { id: 2, name: "Background change" },
    ];
    await act(async () => {
      await ref.current?.refresh({ reason: "edit", rowIds: [1] });
    });
    expect(
      Array.from(desktopRows(view.container)).map((element) =>
        element.getAttribute("data-feedback")
      )
    ).toEqual(["updated", null]);
    list = [...list, { id: 3, name: "Created" }];
    await act(async () => {
      await ref.current?.refresh({ reason: "create", rowIds: [3] });
    });
    expect(
      Array.from(desktopRows(view.container)).map((element) =>
        element.getAttribute("data-feedback")
      )
    ).toEqual([null, null, "added"]);
    list = list.filter(({ id }) => id !== 3);
    await act(async () => {
      await ref.current?.refresh({ reason: "delete", rowIds: [3] });
    });
    await waitFor(() => expect(desktopRows(view.container)).toHaveLength(2));
    expect(view.container.querySelector("tbody")).toBe(body);
  });

  it("does not remount the result area or mark filter/page results as new", async () => {
    const request = vi.fn(async ({ page }: { page: number }) => ({
      list: [{ id: page, name: `Page ${page}` }],
      total: 60,
    }));
    const table = (page: number, search: string) => (
      <ProTable
        columns={columns}
        initialFilters={{ search }}
        initialPagination={{ page, size: 10 }}
        request={request}
      />
    );
    const view = render(table(1, ""));
    await screen.findAllByText("Page 1");
    const body = view.container.querySelector("tbody");
    const cards = view.container.querySelector(".admin-pro-table-mobile");
    view.rerender(table(2, ""));
    await screen.findAllByText("Page 2");
    expect(view.container.querySelector("tbody")).toBe(body);
    expect(view.container.querySelector(".admin-pro-table-mobile")).toBe(cards);
    expect(
      view.container
        .querySelector(".admin-pro-table")
        ?.getAttribute("data-operation")
    ).toBe("pagination");
    expect(view.container.querySelectorAll("[data-feedback]")).toHaveLength(0);
    view.rerender(table(1, "offline"));
    await waitFor(() =>
      expect(
        view.container
          .querySelector(".admin-pro-table")
          ?.getAttribute("data-operation")
      ).toBe("filter")
    );
    expect(view.container.querySelectorAll("[data-feedback]")).toHaveLength(0);
  });

  it("keeps old results while loading/on failure and accepts only the latest response", async () => {
    const ref = action();
    type Result = { list: { id: number; name: string }[]; total: number };
    const pending: ((value: Result) => void)[] = [];
    let initial = true;
    let fail = false;
    const request = vi.fn(() =>
      fail
        ? Promise.reject(new Error("Intentional refresh failure"))
        : initial
          ? Promise.resolve({ list: [{ id: 1, name: "Old" }], total: 1 })
          : new Promise<Result>((resolve) => pending.push(resolve))
    );
    const view = render(
      <ProTable
        action={ref}
        columns={columns}
        mobile={false}
        request={request}
      />
    );
    await screen.findByText("Old");
    initial = false;
    let first: Promise<void> | undefined, second: Promise<void> | undefined;
    act(() => {
      first = ref.current?.refresh();
      second = ref.current?.refresh();
    });
    expect(screen.getByText("Old")).toBeTruthy();
    expect(
      view.container
        .querySelector(".admin-pro-table")
        ?.getAttribute("aria-busy")
    ).toBe("true");
    await act(async () => {
      pending[1]?.({ list: [{ id: 2, name: "Latest" }], total: 1 });
      await second;
    });
    await act(async () => {
      pending[0]?.({ list: [{ id: 3, name: "Obsolete" }], total: 1 });
      await first;
    });
    expect(screen.getByText("Latest")).toBeTruthy();
    expect(screen.queryByText("Obsolete")).toBeNull();
    fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {
      /* Expected mocked failure. */
    });
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(screen.getByText("Latest")).toBeTruthy();
    expect(
      view.container.querySelector(".admin-pro-table-stale-alert")
    ).toBeTruthy();
    log.mockRestore();
  });

  it("mounts the batch toolbar once and only changes its count", async () => {
    render(
      <ProTable
        actions={{
          batchRender: () => [
            <button key="delete" type="button">
              Delete
            </button>,
          ],
        }}
        columns={columns}
        mobile={false}
        request={async () => ({
          list: [
            { id: 1, name: "One" },
            { id: 2, name: "Two" },
          ],
          total: 2,
        })}
      />
    );
    await screen.findByText("One");
    const checkboxes = screen.getAllByRole("checkbox", { name: "Select row" });
    fireEvent.click(checkboxes[0]!);
    const toolbar = screen.getByRole("toolbar", { name: "Batch actions" });
    const wrapper = toolbar.parentElement;
    fireEvent.click(checkboxes[1]!);
    expect(screen.getByRole("toolbar", { name: "Batch actions" })).toBe(
      toolbar
    );
    expect(toolbar.parentElement).toBe(wrapper);
  });
});
