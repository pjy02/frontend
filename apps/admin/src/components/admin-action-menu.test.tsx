// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import { FileText, Trash2 } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminActionMenu,
  AdminActionMenuDangerItem,
  AdminActionMenuGroup,
  AdminActionMenuItem,
  AdminActionMenuSub,
} from "./admin-action-menu";

function mockViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: vi.fn(),
    matches: query.includes("max-width") ? width < 1024 : false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
  }));
}

function MenuProbe({ onDelete = vi.fn() }: { onDelete?: () => void }) {
  return (
    <AdminActionMenu
      description="Actions for this user"
      title="More actions"
      trigger={<Button>Open actions</Button>}
    >
      <AdminActionMenuGroup label="Business">
        <AdminActionMenuItem icon={<FileText />}>Orders</AdminActionMenuItem>
        <AdminActionMenuSub icon={<FileText />} id="logs" label="Logs">
          <AdminActionMenuItem>Login logs</AdminActionMenuItem>
          <AdminActionMenuSub id="audit" label="Audit">
            <AdminActionMenuItem>Risk details</AdminActionMenuItem>
          </AdminActionMenuSub>
        </AdminActionMenuSub>
      </AdminActionMenuGroup>
      <AdminActionMenuDangerItem icon={<Trash2 />} onAction={onDelete}>
        Delete user
      </AdminActionMenuDangerItem>
    </AdminActionMenu>
  );
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminActionMenu", () => {
  it("uses a compact adaptive desktop menu and exposes nested actions", async () => {
    mockViewport(1280);
    render(<MenuProbe />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Open actions" }),
      {
        button: 0,
        ctrlKey: false,
      }
    );

    await waitFor(() => expect(screen.getByText("Orders")).toBeTruthy());
    const content = document.querySelector(".admin-action-menu-content");
    expect(content?.className).toContain("w-max");
    expect(content?.className).toContain("min-w-40");
    expect(content?.className).toContain("max-w-[220px]");
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(screen.getByText("Logs")).toBeTruthy();
  });

  it("opens the desktop menu from the keyboard", async () => {
    mockViewport(1440);
    render(<MenuProbe />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Open actions" }), {
      key: "Enter",
    });

    await waitFor(() => expect(screen.getByText("Orders")).toBeTruthy());
    expect(document.querySelector('[role="menu"]')).toBeTruthy();
  });

  it("adds a tooltip only when an item label is visually truncated", async () => {
    mockViewport(1280);
    const scrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth"
    );
    const clientWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth"
    );
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 240,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 80,
    });

    try {
      render(<MenuProbe />);
      fireEvent.keyDown(screen.getByRole("button", { name: "Open actions" }), {
        key: "Enter",
      });

      await waitFor(() =>
        expect(screen.getByText("Orders").dataset.slot).toBe("tooltip-trigger")
      );
    } finally {
      if (scrollWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollWidth",
          scrollWidth
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth");
      }
      if (clientWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          clientWidth
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    }
  });

  it("uses an in-panel hierarchy on mobile and supports a third level", async () => {
    mockViewport(390);
    render(<MenuProbe />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open actions" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Open actions" }));

    await waitFor(() => expect(screen.getByText("More actions")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Logs" }));
    expect(screen.getByText("Login logs")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Audit" }));
    expect(screen.getByText("Risk details")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Orders")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByText("Risk details")).toBeNull());
    expect(screen.getByText("Login logs")).toBeTruthy();
  });

  it("runs destructive actions from the mobile panel", async () => {
    mockViewport(430);
    const onDelete = vi.fn();
    render(<MenuProbe onDelete={onDelete} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open actions" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Open actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete user" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
