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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "./motion-provider";
import { adminMotionProfile } from "./motion-tokens";
import { AdminPageTransition } from "./page-transition";

const animation = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }));
const originalAnimate = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate"
);
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: (...args: unknown[]) => {
      animation.start(...args);
      return { cancel: animation.stop };
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  animation.start.mockClear();
  animation.stop.mockClear();
  if (originalAnimate)
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

function Field({ mount }: { mount: () => void }) {
  useEffect(mount, [mount]);
  return <input aria-label="Draft" defaultValue="Original" />;
}

describe("navigation continuity", () => {
  it("does not replay an unchanged route when the profile is reconfigured", () => {
    const view = render(
      <MotionProvider>
        <AdminPageTransition transitionKey="users">Users</AdminPageTransition>
      </MotionProvider>
    );
    view.rerender(
      <MotionProvider
        profile={{
          ...adminMotionProfile,
          navigation: { ...adminMotionProfile.navigation, duration: 100 },
        }}
      >
        <AdminPageTransition transitionKey="users">Users</AdminPageTransition>
      </MotionProvider>
    );
    expect(animation.start).toHaveBeenCalledOnce();
    expect(animation.stop).toHaveBeenCalledOnce();
    expect(animation.start.mock.calls[0]?.[1]).toMatchObject({
      fill: "none",
      duration: 200,
    });
  });
  it("keeps content mounted while changing the animation target and cancels the previous animation", () => {
    const mount = vi.fn();
    const view = (key: string) => (
      <MotionProvider>
        <AdminPageTransition transitionKey={key}>
          <Field mount={mount} />
        </AdminPageTransition>
      </MotionProvider>
    );
    const result = render(view("users"));
    const input = screen.getByLabelText("Draft");
    fireEvent.change(input, { target: { value: "Unsaved" } });
    result.rerender(view("servers"));
    expect(screen.getByLabelText("Draft")).toBe(input);
    expect((input as HTMLInputElement).value).toBe("Unsaved");
    expect(mount).toHaveBeenCalledTimes(1);
    expect(animation.start).toHaveBeenCalledTimes(2);
    expect(animation.stop).toHaveBeenCalledTimes(1);
    result.rerender(view("servers"));
    expect(animation.start).toHaveBeenCalledTimes(2);
    result.unmount();
    expect(animation.stop).toHaveBeenCalledTimes(2);
  });

  it("skips page movement in reduced-motion mode", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <MotionProvider>
        <AdminPageTransition transitionKey="users">Users</AdminPageTransition>
      </MotionProvider>
    );
    expect(animation.start).not.toHaveBeenCalled();
  });

  it("measures unequal labels, more than six tabs, resizes and scroll coordinates", async () => {
    for (const [property, dataset] of [
      ["offsetLeft", "x"],
      ["offsetTop", "y"],
      ["offsetWidth", "width"],
      ["offsetHeight", "height"],
    ] as const) {
      vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(
        function (this: HTMLElement) {
          return Number(this.dataset[dataset] || 0);
        }
      );
    }
    let resize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {
          /* Manual geometry updates. */
        }
        disconnect = disconnect;
      }
    );
    const tabs = (value: string) => (
      <MotionProvider>
        <Tabs value={value}>
          <TabsList data-height="36" data-width="400">
            {Array.from({ length: 8 }, (_, index) => (
              <TabsTrigger
                data-height="30"
                data-width={index === 7 ? 150 : 90}
                data-x={index * 90 + 3}
                data-y="3"
                key={index}
                value={String(index)}
              >
                Section {index}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </MotionProvider>
    );
    const view = render(tabs("7"));
    const list = screen.getByRole("tablist");
    expect(list.style.getPropertyValue("--admin-tabs-x")).toBe("633px");
    expect(list.style.getPropertyValue("--admin-tabs-width")).toBe("150px");
    expect(list.dataset.indicatorAnimated).toBe("false");
    view.rerender(tabs("1"));
    await waitFor(() =>
      expect(list.style.getPropertyValue("--admin-tabs-x")).toBe("93px")
    );
    expect(list.dataset.indicatorAnimated).toBe("true");
    list.scrollLeft = 100;
    fireEvent.scroll(list);
    expect(list.style.getPropertyValue("--admin-tabs-x")).toBe("93px");
    screen.getByRole("tab", { name: "Section 1" }).dataset.width = "132";
    act(() => resize?.());
    expect(list.style.getPropertyValue("--admin-tabs-width")).toBe("132px");
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(list.style.getPropertyValue("--admin-tabs-width")).toBe("");
  });

  it("lazily preserves visited form tabs without exposing hidden controls", () => {
    render(
      <Tabs defaultValue="a" preserveContent>
        <TabsList>
          <TabsTrigger value="a">Basic</TabsTrigger>
          <TabsTrigger value="b">Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <input aria-label="Name" defaultValue="Original" />
        </TabsContent>
        <TabsContent value="b">
          <input aria-label="Price" />
        </TabsContent>
      </Tabs>
    );
    const name = screen.getByLabelText("Name");
    expect(screen.queryByLabelText("Price")).toBeNull();
    fireEvent.change(name, { target: { value: "Changed" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Pricing" }), {
      button: 0,
    });
    expect(name.isConnected).toBe(true);
    expect(name.closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Basic" }), {
      button: 0,
    });
    expect(screen.getByLabelText("Name")).toBe(name);
    expect((name as HTMLInputElement).value).toBe("Changed");
  });

  it("keeps default shared tabs behavior without an Admin profile or preserveContent opt-in", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Basic</TabsTrigger>
          <TabsTrigger value="b">Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <input aria-label="Name" />
        </TabsContent>
        <TabsContent value="b">Price</TabsContent>
      </Tabs>
    );
    const name = screen.getByLabelText("Name");
    expect(screen.getByRole("tablist").dataset.indicatorReady).toBeUndefined();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Pricing" }), {
      button: 0,
    });
    expect(name.isConnected).toBe(false);
  });
});
