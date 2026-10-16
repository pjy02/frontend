// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render as renderView,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import { FileText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminActionMenu,
  AdminActionMenuDangerItem,
  AdminActionMenuGroup,
  AdminActionMenuItem,
  AdminActionMenuSub,
} from "./admin-action-menu";
import { MotionProvider } from "./motion-provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function render(children: ReactNode) {
  return renderView(<MotionProvider>{children}</MotionProvider>);
}

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

function MenuProbe({
  onDelete = vi.fn(),
  onOrder = vi.fn(),
}: {
  onDelete?: () => void;
  onOrder?: () => void;
}) {
  return (
    <AdminActionMenu
      description="Actions for this user"
      title="More actions"
      trigger={<Button>Open actions</Button>}
    >
      <AdminActionMenuGroup label="Business">
        <AdminActionMenuItem icon={<FileText />} onAction={onOrder}>
          Orders
        </AdminActionMenuItem>
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
  it.each([
    390, 1440,
  ])("locks pending actions and restores retry after rejection at %ipx", async (width) => {
    mockViewport(width);
    let reject: ((error: Error) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        })
    );
    render(
      <AdminActionMenu title="Tasks" trigger={<Button>Open tasks</Button>}>
        <AdminActionMenuItem closeOnSelect={false} onAction={action}>
          Copy configuration
        </AdminActionMenuItem>
      </AdminActionMenu>
    );
    const trigger = screen.getByRole("button", { name: "Open tasks" });
    if (width < 1024) fireEvent.click(trigger);
    else fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByRole(width < 1024 ? "button" : "menuitem", {
      name: "Copy configuration",
    });
    fireEvent.click(item);
    fireEvent.click(item);
    expect(action).toHaveBeenCalledOnce();
    expect(item.getAttribute("aria-busy")).toBe("true");
    reject?.(new Error("Fixture failure"));
    await waitFor(() => expect(item.getAttribute("aria-busy")).toBeNull());
    expect(toast.error).toHaveBeenCalled();
    fireEvent.click(item);
    expect(action).toHaveBeenCalledTimes(2);
    reject?.(new Error("Fixture failure"));
    await waitFor(() => expect(item.getAttribute("aria-busy")).toBeNull());
  });

  it("closes mobile levels one at a time with Escape and restores the category trigger", async () => {
    mockViewport(390);
    render(<MenuProbe />);
    fireEvent.click(screen.getByRole("button", { name: "Open actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Logs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Audit" }));
    const back = await screen.findByRole("button", { name: "Back" });
    fireEvent.keyDown(back, { key: "Escape" });
    const audit = await screen.findByRole("button", { name: "Audit" });
    await waitFor(() => expect(document.activeElement).toBe(audit));
    fireEvent.keyDown(audit, { key: "Escape" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Logs" })
      )
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "Logs" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-slot="admin-mobile-action-panel"]')
          ?.getAttribute("data-state")
      ).toBe("closed")
    );
  });
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

  it("supports desktop arrow navigation, nested escape, and focus restore", async () => {
    mockViewport(1440);
    render(<MenuProbe />);
    const trigger = screen.getByRole("button", { name: "Open actions" });

    fireEvent.keyDown(trigger, { key: " " });
    const orders = await screen.findByRole("menuitem", { name: "Orders" });
    orders.focus();
    fireEvent.keyDown(orders, { key: "ArrowDown" });
    const logs = screen.getByRole("menuitem", { name: "Logs" });
    await waitFor(() => expect(document.activeElement).toBe(logs));

    fireEvent.keyDown(logs, { key: "ArrowRight" });
    const loginLogs = await screen.findByRole("menuitem", {
      name: "Login logs",
    });
    fireEvent.keyDown(loginLogs, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Login logs" })).toBeNull()
    );

    fireEvent.keyDown(logs, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Orders")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps one menu instance during rapid clicks and closes outside", async () => {
    mockViewport(1280);
    render(<MenuProbe />);
    const trigger = screen.getByRole("button", { name: "Open actions" });

    for (let index = 0; index < 3; index += 1) {
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    }
    await screen.findByText("Orders");
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByText("Orders")).toBeNull());
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

  it("supports mobile arrow hierarchy and ignores a scrolled touch", async () => {
    mockViewport(390);
    const onOrder = vi.fn();
    render(<MenuProbe onOrder={onOrder} />);

    fireEvent.click(screen.getByRole("button", { name: "Open actions" }));
    const orders = await screen.findByRole("button", { name: "Orders" });
    await waitFor(() => expect(document.activeElement).toBe(orders));

    fireEvent.keyDown(orders, { key: "ArrowDown" });
    const logs = screen.getByRole("button", { name: "Logs" });
    expect(document.activeElement).toBe(logs);
    fireEvent.keyDown(logs, { key: "ArrowRight" });
    const back = await screen.findByRole("button", { name: "Back" });
    await waitFor(() => expect(document.activeElement).toBe(back));

    fireEvent.keyDown(back, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.queryByText("Login logs")).toBeNull());
    const restoredOrders = screen.getByRole("button", { name: "Orders" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Logs" })
      )
    );
    fireEvent.touchStart(restoredOrders, {
      changedTouches: [{ clientX: 20, clientY: 20 }],
      touches: [{ clientX: 20, clientY: 20 }],
    });
    fireEvent.touchMove(restoredOrders, {
      changedTouches: [{ clientX: 20, clientY: 48 }],
      touches: [{ clientX: 20, clientY: 48 }],
    });
    fireEvent.click(restoredOrders);

    expect(onOrder).not.toHaveBeenCalled();
    expect(screen.getByText("More actions")).toBeTruthy();
  });
});
