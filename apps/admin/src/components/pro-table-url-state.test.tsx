// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { ProTable } from "@workspace/ui/composed/pro-table/pro-table";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@workspace/ui/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => true,
}));

afterEach(cleanup);

describe("ProTable URL-restored state", () => {
  it("applies changed initial filters and pagination without remounting", async () => {
    const request = vi.fn(async () => ({ list: [], total: 0 }));
    const columns = [{ accessorKey: "id", header: "ID" }];
    const { rerender } = render(
      <ProTable
        columns={columns}
        header={{ hidden: true }}
        initialFilters={{ user_id: 7 }}
        initialPagination={{ page: 2, size: 20 }}
        mobile={false}
        pagination={false}
        request={request}
      />
    );

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(
        { page: 2, size: 20 },
        { user_id: 7 }
      );
    });

    rerender(
      <ProTable
        columns={columns}
        header={{ hidden: true }}
        initialFilters={{ user_id: 19 }}
        initialPagination={{ page: 4, size: 50 }}
        mobile={false}
        pagination={false}
        request={request}
      />
    );

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(
        { page: 4, size: 50 },
        { user_id: 19 }
      );
    });
  });
});
