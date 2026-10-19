// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { usePresenceInert } from "@workspace/ui/hooks/use-presence-inert";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminActionMenu, AdminActionMenuItem } from "./admin-action-menu";
import { MotionProvider } from "./motion-provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        /* jsdom has no layout observer. */
      }
      unobserve() {
        /* jsdom has no layout observer. */
      }
      disconnect() {
        /* jsdom has no layout observer. */
      }
    }
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  false,
  true,
])("makes retained closing content inert only with the Admin profile (%s)", async (enabled) => {
  function Probe({ state }: { state: string }) {
    const ref = usePresenceInert<HTMLDivElement>();
    return (
      <div data-state={state} data-testid="retained" ref={ref}>
        Content
      </div>
    );
  }
  const view = (state: string) =>
    enabled ? (
      <MotionProvider>
        <Probe state={state} />
      </MotionProvider>
    ) : (
      <Probe state={state} />
    );
  const rendered = render(view("open"));
  const node = screen.getByTestId("retained");
  rendered.rerender(view("closed"));
  await waitFor(() => expect(node.inert).toBe(enabled ? true : undefined));
  expect(node.isConnected).toBe(true);
  if (enabled) {
    rendered.rerender(view("open"));
    await waitFor(() => expect(node.inert).toBe(false));
  }
});

it("shares the tooltip warm-up window without stealing form focus", async () => {
  render(
    <MotionProvider>
      <input aria-label="Editing" />
      {["First", "Second"].map((label) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button type="button">{label}</button>
          </TooltipTrigger>
          <TooltipContent>{label} hint</TooltipContent>
        </Tooltip>
      ))}
    </MotionProvider>
  );
  const input = screen.getByRole("textbox");
  input.focus();
  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });
  const move = (target: HTMLElement) => {
    const event = new Event("pointermove", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    fireEvent(target, event);
  };
  move(first);
  await waitFor(() =>
    expect(
      document.querySelector(
        '[data-slot="tooltip-content"][data-state="delayed-open"]'
      )
    ).toBeTruthy()
  );
  expect(document.activeElement).toBe(input);
  fireEvent.pointerOut(first, { relatedTarget: second });
  move(second);
  await waitFor(() =>
    expect(
      document.querySelector(
        '[data-slot="tooltip-content"][data-state="instant-open"]'
      )
    ).toBeTruthy()
  );
  expect(document.activeElement).toBe(input);
});

it.each([
  390, 1440,
])("hands a menu directly to a dialog and restores its root trigger at %ipx", async (width) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  function Fixture() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <AdminActionMenu
          title="Actions"
          trigger={<button type="button">More</button>}
        >
          <AdminActionMenuItem onAction={() => setOpen(true)}>
            Inspect
          </AdminActionMenuItem>
        </AdminActionMenu>
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogContent>
            <DialogTitle>Inspect record</DialogTitle>
            <DialogDescription>Details</DialogDescription>
            <DialogClose>Done</DialogClose>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  render(
    <MotionProvider>
      <Fixture />
    </MotionProvider>
  );
  const trigger = screen.getByRole("button", { name: "More" });
  if (width < 1024) fireEvent.click(trigger);
  else fireEvent.keyDown(trigger, { key: "Enter" });
  const action = await screen.findByRole(width < 1024 ? "button" : "menuitem", {
    name: "Inspect",
  });
  const focused = vi.fn();
  trigger.addEventListener("focus", focused);
  fireEvent.click(action);
  const done = await screen.findByRole("button", { name: "Done" });
  await waitFor(() =>
    expect(
      document.activeElement?.closest('[data-slot="dialog-content"]')
    ).toBeTruthy()
  );
  expect(focused).not.toHaveBeenCalled();
  fireEvent.click(done);
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("keeps an accordion's switch independent of its expand button", async () => {
  render(
    <MotionProvider>
      <Accordion collapsible type="single">
        <AccordionItem value="protocol">
          <AccordionTrigger trailing={<Switch aria-label="Enable protocol" />}>
            Protocol
          </AccordionTrigger>
          <AccordionContent>Configuration</AccordionContent>
        </AccordionItem>
      </Accordion>
    </MotionProvider>
  );
  expect(document.querySelector("button button")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Protocol" });
  fireEvent.click(screen.getByRole("switch"));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  expect(await screen.findByText("Configuration")).toBeTruthy();
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

it("fades unrelated tabs and retains a single opted-in form instance", async () => {
  const mounts = vi.fn();
  function Form() {
    useState(() => mounts());
    return <input aria-label="Draft" defaultValue="unchanged" />;
  }
  render(
    <MotionProvider>
      <Tabs defaultValue="one" preserveContent>
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">
          <Form />
        </TabsContent>
        <TabsContent value="two">Other content</TabsContent>
      </Tabs>
    </MotionProvider>
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "keep draft" } });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Two" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "One" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(screen.getByRole("textbox")).toBe(input);
  expect((input as HTMLInputElement).value).toBe("keep draft");
  expect(mounts).toHaveBeenCalledOnce();
  expect(
    document
      .querySelector('[data-slot="tabs-content"]')
      ?.getAttribute("data-transition-mode")
  ).toBe("fade");
});

it("restores a closed dialog to the adjacent row after its trigger is deleted", async () => {
  function Fixture() {
    const [removed, remove] = useState(false);
    return (
      <Dialog>
        <div className="admin-pro-table">
          <table>
            <tbody>
              {!removed && (
                <tr>
                  <td>
                    <DialogTrigger>First row</DialogTrigger>
                  </td>
                </tr>
              )}
              <tr>
                <td>
                  <button type="button">Next row</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <DialogContent>
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription>Details</DialogDescription>
          <button onClick={() => remove(true)} type="button">
            Delete record
          </button>
          <DialogClose>Finish</DialogClose>
        </DialogContent>
      </Dialog>
    );
  }
  render(
    <MotionProvider>
      <Fixture />
    </MotionProvider>
  );
  const trigger = screen.getByRole("button", { name: "First row" });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Delete record" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Next row" })
    )
  );
});

it("returns a nested dialog to its action inside the still-open parent", async () => {
  render(
    <MotionProvider>
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Outer</DialogTitle>
          <DialogDescription>Workspace</DialogDescription>
          <Dialog>
            <DialogTrigger>Inner action</DialogTrigger>
            <DialogContent>
              <DialogTitle>Inner</DialogTitle>
              <DialogDescription>Confirm</DialogDescription>
              <DialogClose>Cancel inner</DialogClose>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </MotionProvider>
  );
  const action = screen.getByRole("button", { name: "Inner action" });
  action.focus();
  fireEvent.click(action);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel inner" }));
  await waitFor(() => expect(document.activeElement).toBe(action));
  expect(screen.getByRole("dialog")).toBeTruthy();
});
