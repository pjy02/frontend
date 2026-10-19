// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { FilterTextInput } from "@workspace/ui/composed/pro-table/column-filter";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import { TablePreferencesProvider } from "@workspace/ui/composed/pro-table/view-preferences";
import { StrictMode, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import {
  WorkspaceDialog,
  WorkspaceDialogContent,
  WorkspaceDialogTitle,
} from "./workspace-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const columns = [{ accessorKey: "name", header: "Name" }];

describe("single responsive presentation with persistent workspaces", () => {
  it("follows the Admin tablet policy at 1024px instead of mounting a CSS-hidden desktop table", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("1279"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(
      <MotionProvider>
        <TablePreferencesProvider
          value={{ accountKey: null, pageKey: "tablet" }}
        >
          <ProTable
            columns={columns}
            request={async () => ({
              list: [{ id: 1, name: "Tablet record" }],
              total: 1,
            })}
          />
        </TablePreferencesProvider>
      </MotionProvider>
    );
    await screen.findByText("Tablet record");
    expect(container.querySelectorAll(".admin-pro-table-mobile")).toHaveLength(
      1
    );
    expect(container.querySelectorAll(".admin-pro-table-desktop")).toHaveLength(
      0
    );
  });
  it("mounts each editor once and preserves it through breakpoint changes and refresh", async () => {
    let compact = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() {
        return query.includes("max-width") && compact;
      },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }));
    const mounts = vi.fn(),
      unmounts = vi.fn();
    function Editor() {
      const [open, setOpen] = useState(false),
        [value, setValue] = useState("Original");
      useEffect(() => {
        mounts();
        return () => {
          unmounts();
        };
      }, []);
      return (
        <WorkspaceDialog onOpenChange={setOpen} open={open}>
          <button onClick={() => setOpen(true)} type="button">
            Edit fixture
          </button>
          <WorkspaceDialogContent aria-describedby={undefined}>
            <WorkspaceDialogTitle>Editor</WorkspaceDialogTitle>
            <input
              aria-label="Draft"
              onChange={(e) => setValue(e.target.value)}
              value={value}
            />
          </WorkspaceDialogContent>
        </WorkspaceDialog>
      );
    }
    const action = { current: null as ProTableActions | null };
    const { container } = render(
      <StrictMode>
        <MotionProvider>
          <ProTable
            action={action}
            actions={{ render: () => [<Editor key="editor" />] }}
            columns={columns}
            request={async () => ({
              list: [{ id: 7, name: "Record" }],
              total: 1,
            })}
          />
        </MotionProvider>
      </StrictMode>
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit fixture" })
    );
    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "Private unsaved draft" },
    });
    const input = screen.getByLabelText("Draft"),
      mountCount = mounts.mock.calls.length,
      unmountCount = unmounts.mock.calls.length;
    expect(container.querySelectorAll(".admin-pro-table-mobile")).toHaveLength(
      0
    );
    await act(async () => {
      compact = true;
      for (const listener of listeners) listener();
    });
    expect(container.querySelectorAll(".admin-pro-table-desktop")).toHaveLength(
      0
    );
    expect(container.querySelectorAll(".admin-pro-table-card")).toHaveLength(1);
    await act(async () => {
      await action.current?.refresh();
    });
    await act(async () => {
      compact = false;
      for (const listener of listeners) listener();
    });
    expect(screen.getByLabelText("Draft")).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Private unsaved draft");
    expect(mounts).toHaveBeenCalledTimes(mountCount);
    expect(unmounts).toHaveBeenCalledTimes(unmountCount);
  });
  it("corrects the page after deleting its last record", async () => {
    let deleted = false;
    const request = vi.fn(async ({ page }: { page: number }) => ({
      list:
        page === 2
          ? deleted
            ? []
            : [{ id: 11, name: "Last" }]
          : [{ id: 1, name: "First" }],
      total: deleted ? 10 : 11,
    }));
    const action = { current: null as ProTableActions | null },
      pages = vi.fn();
    render(
      <MotionProvider>
        <ProTable
          action={action}
          columns={columns}
          initialPagination={{ page: 2, size: 10 }}
          onPaginationChange={pages}
          request={request}
        />
      </MotionProvider>
    );
    await screen.findByText("Last");
    deleted = true;
    await act(async () => {
      await action.current?.refresh({ reason: "delete", rowIds: [11] });
    });
    await screen.findByText("First");
    expect(pages).toHaveBeenLastCalledWith({ page: 1, size: 10 });
  });
  it("aborts a superseded read and ignores an uncooperative older result", async () => {
    let finish!: (value: {
      list: { id: number; name: string }[];
      total: number;
    }) => void;
    const signals: AbortSignal[] = [];
    const request = vi.fn(
      async (
        _page: { page: number; size: number },
        filter: Record<string, string>,
        { signal }: { signal: AbortSignal }
      ) => {
        signals.push(signal);
        if (!filter.search)
          return new Promise<{
            list: { id: number; name: string }[];
            total: number;
          }>((resolve) => {
            finish = resolve;
          });
        return { list: [{ id: 2, name: "Latest" }], total: 1 };
      }
    );
    render(
      <MotionProvider>
        <ProTable
          columns={columns}
          params={[{ key: "search" }]}
          request={request}
        />
      </MotionProvider>
    );
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "New" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await screen.findByText("Latest");
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      finish({ list: [{ id: 1, name: "Outdated" }], total: 1 });
    });
    expect(screen.queryByText("Outdated")).toBeNull();
  });
});

describe("text filter scheduling", () => {
  it("cancels an uncommitted search when reset keeps the same empty committed value", async () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const view = render(
      <FilterTextInput debounce onValueChange={change} resetKey={0} value="" />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Uncommitted" },
    });
    view.rerender(
      <FilterTextInput debounce onValueChange={change} resetKey={1} value="" />
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(change).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
  it("debounces typing, protects IME, flushes Enter and cancels on URL restore", async () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const view = render(
      <FilterTextInput
        aria-label="Search"
        debounce
        onValueChange={change}
        value=""
      />
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(change).not.toHaveBeenCalled();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "节点" } });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(change).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(change).toHaveBeenLastCalledWith("节点");
    fireEvent.change(input, { target: { value: "server" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenLastCalledWith("server");
    fireEvent.change(input, { target: { value: "pending" } });
    view.rerender(
      <FilterTextInput
        aria-label="Search"
        debounce
        onValueChange={change}
        value="Restored"
      />
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(change).not.toHaveBeenCalledWith("pending");
    expect((input as HTMLInputElement).value).toBe("Restored");
  });
});
