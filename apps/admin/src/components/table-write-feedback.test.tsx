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
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("@workspace/ui/composed/pro-table/wrapper", () => ({
  ProTableWrapper: ({
    children,
    data,
    onSort,
    setData,
  }: {
    children: ReactNode;
    data: { id: number; name: string }[];
    onSort?: (
      source: number,
      target: number,
      data: { id: number; name: string }[]
    ) => Promise<{ id: number; name: string }[]>;
    setData: (data: { id: number; name: string }[]) => void;
  }) => (
    <>
      {children}
      {onSort && (
        <button
          onClick={async () => setData(await onSort(1, 2, data))}
          type="button"
        >
          Sort fixture
        </button>
      )}
    </>
  ),
}));
afterEach(cleanup);
const columns = [{ accessorKey: "name", header: "Name" }];
const records = () => [
  { id: 1, name: "One" },
  { id: 2, name: "Two" },
];

describe("table write/read truth boundaries", () => {
  it("exposes an opt-in sync failure while retaining the last successful records", async () => {
    const ref = { current: null as ProTableActions | null };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ list: records(), total: 2 })
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValue({ list: [{ id: 1, name: "Updated" }], total: 1 });
    render(
      <MotionProvider>
        <ProTable action={ref} columns={columns} request={request} />
      </MotionProvider>
    );
    await screen.findAllByText("One");
    await act(async () => {
      await expect(
        ref.current?.refresh({ throwOnError: true })
      ).rejects.toThrow("read failed");
    });
    expect(screen.getAllByText("One").length).toBeGreaterThan(0);
    await act(async () => {
      await ref.current?.refresh({ throwOnError: true });
    });
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
  });

  it("snapshots a mutating sort callback, shares its lock and restores failure", async () => {
    let fail: ((error: Error) => void) | undefined;
    const original = records();
    const sort = vi.fn(
      async (_from, _to, data: { id: number; name: string }[]) => {
        data.reverse();
        await new Promise<void>((_resolve, reject) => {
          fail = reject;
        });
        return data;
      }
    );
    const { container } = render(
      <MotionProvider>
        <ProTable
          columns={columns}
          onSort={sort}
          request={async () => ({ list: original, total: 2 })}
        />
      </MotionProvider>
    );
    await screen.findAllByText("One");
    act(() => {
      const buttons = screen.getAllByRole("button", { name: "Sort fixture" });
      fireEvent.click(buttons[0]!);
      fireEvent.click(buttons[0]!);
    });
    await waitFor(() => expect(sort).toHaveBeenCalledTimes(1));
    expect(original.map((item) => item.id)).toEqual([1, 2]);
    expect(
      container
        .querySelector(".admin-pro-table")
        ?.getAttribute("data-sort-pending")
    ).toBe("true");
    await act(async () => fail?.(new Error("write failed")));
    await screen.findByRole("alert");
    expect(original.map((item) => item.id)).toEqual([1, 2]);
    expect(
      [...container.querySelectorAll("tbody tr")].map((row) => row.textContent)
    ).toEqual(["One", "Two"]);
  });
});
