// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SidebarProvider } from "@workspace/ui/components/sidebar";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarLeft } from "./sidebar-left";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => "/dashboard/servers",
}));
vi.mock("@/stores/global", () => ({
  useGlobalStore: () => ({ common: { site: { site_name: "PPanel" } } }),
}));
vi.mock("./navs", () => {
  const navs = [
    {
      title: "Infrastructure",
      items: [
        { title: "Servers", url: "/dashboard/servers" },
        { title: "Nodes", url: "/dashboard/nodes" },
      ],
    },
  ];
  return { useNavs: () => navs };
});
vi.mock("./timezone-switch", () => ({ default: () => null }));
vi.mock("@workspace/ui/composed/language-switch", () => ({
  LanguageSwitch: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens collapsed navigation with the keyboard, moves through links and restores focus", async () => {
  render(
    <SidebarProvider defaultOpen={false}>
      <SidebarLeft />
    </SidebarProvider>
  );
  const trigger = screen.getByRole("button", { name: "Infrastructure" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  await screen.findByRole("menu", { name: "Infrastructure" });
  const servers = screen.getByRole("menuitem", { name: "Servers" });
  await waitFor(() => expect(document.activeElement).toBe(servers));
  fireEvent.keyDown(servers, { key: "ArrowDown" });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Nodes" })
    )
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("immediately removes collapsed group links from interactive navigation", async () => {
  render(
    <SidebarProvider defaultOpen>
      <SidebarLeft />
    </SidebarProvider>
  );
  const group = screen.getByRole("button", { name: "Infrastructure" });
  await waitFor(() => expect(group.getAttribute("aria-expanded")).toBe("true"));
  fireEvent.click(group);
  expect(group.getAttribute("aria-expanded")).toBe("false");
  const content = document.getElementById(group.getAttribute("aria-controls")!);
  expect(content?.querySelector("[inert]")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Nodes" })).toBeNull();
});
