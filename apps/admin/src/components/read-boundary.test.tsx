// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadBoundary, requireReadData } from "./read-boundary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
afterEach(cleanup);

describe("read state handoff", () => {
  it("rejects malformed missing payloads rather than presenting blank configuration", () => {
    expect(() => requireReadData(undefined)).toThrow("did not contain data");
    expect(requireReadData(null)).toBeNull();
    expect(requireReadData({})).toEqual({});
  });
  it("does not mount editable defaults during the first read or its failure", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const children = <input aria-label="Secret" defaultValue="" />;
    const view = render(
      <ReadBoundary
        configuration
        query={{ data: undefined, isFetching: true, refetch }}
      >
        {children}
      </ReadBoundary>
    );
    expect(screen.getByRole("status", { name: "Loading data" })).toBeTruthy();
    expect(screen.queryByLabelText("Secret")).toBeNull();
    view.rerender(
      <ReadBoundary
        configuration
        query={{ data: undefined, isError: true, refetch }}
      >
        {children}
      </ReadBoundary>
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to load data"
    );
    expect(screen.queryByLabelText("Secret")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("retains input identity and edits during refresh and stale-data failure", () => {
    const query = {
      data: { id: 1 },
      refetch: vi.fn().mockResolvedValue(undefined),
    };
    const children = <input aria-label="Name" defaultValue="Saved" />;
    const view = render(<ReadBoundary query={query}>{children}</ReadBoundary>);
    const field = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Draft" } });
    view.rerender(
      <ReadBoundary query={{ ...query, isFetching: true }}>
        {children}
      </ReadBoundary>
    );
    expect(screen.getByLabelText("Name")).toBe(field);
    view.rerender(
      <ReadBoundary query={{ ...query, isError: true }}>
        {children}
      </ReadBoundary>
    );
    expect(screen.getByLabelText("Name")).toBe(field);
    expect(field.value).toBe("Draft");
    expect(screen.getByRole("status").textContent).toContain(
      "Showing previously loaded data"
    );
  });
  it("distinguishes verified empty configuration from empty records", () => {
    const query = { data: null, refetch: vi.fn().mockResolvedValue(undefined) };
    const view = render(
      <ReadBoundary configuration query={query}>
        <input aria-label="New configuration" />
      </ReadBoundary>
    );
    expect(screen.getByText(/Not configured yet/)).toBeTruthy();
    expect(screen.getByLabelText("New configuration")).toBeTruthy();
    view.rerender(
      <ReadBoundary empty query={{ ...query, data: [] }}>
        <span>Records</span>
      </ReadBoundary>
    );
    expect(
      screen.getByRole("heading", { name: "No data available" })
    ).toBeTruthy();
    expect(screen.queryByText("Records")).toBeNull();
  });
});
