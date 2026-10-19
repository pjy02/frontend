// @vitest-environment jsdom
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changedFormFields,
  formErrorEntries,
  useFormSafety,
} from "./form-safety";
import {
  WorkspaceDialog,
  WorkspaceDialogContent,
  WorkspaceDialogTitle,
} from "./workspace-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: { count?: number }) =>
      fallback.replace("{{count}}", String(values?.count)),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({
  save = async () => {
    /* No-op successful fixture. */
  },
  close,
  review = true,
}: {
  save?: () => Promise<void>;
  close?: () => Promise<void>;
  review?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const form = useForm({
    defaultValues: { name: "Original", secret: "private-key-do-not-display" },
  });
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: (next) => {
      if (!next && close) return close();
      setOpen(next);
    },
    review,
  });
  return (
    <WorkspaceDialog onOpenChange={safety.requestOpenChange} open={open}>
      <WorkspaceDialogContent aria-describedby={undefined}>
        <WorkspaceDialogTitle>Editor</WorkspaceDialogTitle>
        <Form {...form}>
          <form
            data-locked={safety.busy}
            data-submitting={safety.submitting}
            data-testid="saving-phase"
            onSubmit={safety.handleSubmit(async () => {
              await save();
              await safety.completeSave();
            })}
          >
            {safety.summary}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              rules={{ required: "Name is required" }}
            />
            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private key</FormLabel>
                  <FormControl>
                    <input type="password" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit">Save</Button>
            <Button
              onClick={() => safety.requestOpenChange(false)}
              type="button"
            >
              Close editor
            </Button>
          </form>
        </Form>
      </WorkspaceDialogContent>
      {safety.dialogs}
    </WorkspaceDialog>
  );
}

function TabbedErrors() {
  const form = useForm({ defaultValues: { name: "", notes: "" } });
  const safety = useFormSafety({ form, open: true, onOpenChange: vi.fn() });
  return (
    <Form {...form}>
      <form onSubmit={safety.handleSubmit(vi.fn())}>
        {safety.summary}
        <Tabs defaultValue="basic" preserveContent>
          <TabsList>
            <TabsTrigger data-form-path="name" value="basic">
              Basic
            </TabsTrigger>
            <TabsTrigger data-form-path="notes" value="notes">
              Notes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="basic">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="notes">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes field</FormLabel>
                  <FormControl>
                    <input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
        <Button
          onClick={() => form.setError("notes", { message: "Fix notes" })}
          type="button"
        >
          Set hidden error
        </Button>
        <Button onClick={() => form.clearErrors()} type="button">
          Clear errors
        </Button>
      </form>
    </Form>
  );
}
const edit = () =>
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Changed" },
  });

describe("complex form safety", () => {
  it("locks during review without claiming a write is in progress", async () => {
    let finish!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    render(<Harness save={save} />);
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alertdialog");
    expect(screen.getByTestId("saving-phase").getAttribute("data-locked")).toBe(
      "true"
    );
    expect(
      screen.getByTestId("saving-phase").getAttribute("data-submitting")
    ).toBe("false");
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(
      screen.getByTestId("saving-phase").getAttribute("data-submitting")
    ).toBe("true");
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("saves an ordinary edit once, without a second review", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Harness review={false} save={save} />);
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("retains discarded inputs during asynchronous exit", async () => {
    let finish!: () => void;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    render(<Harness close={close} />);
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Discard changes" })
    );
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Changed"
    );
    finish();
  });
  it("reveals a previously mounted hidden tab before focusing its error and retains the summary region", async () => {
    render(<TabbedErrors />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notes" }), {
      button: 0,
    });
    const notes = screen.getByRole("textbox", { name: "Notes field" });
    fireEvent.change(notes, { target: { value: "Unsaved notes" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Basic" }), {
      button: 0,
    });
    fireEvent.click(screen.getByRole("button", { name: "Set hidden error" }));
    const region = document.querySelector(".admin-form-summary-region");
    expect(region?.getAttribute("data-state")).toBe("visible");
    fireEvent.click(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Notes field: Fix notes",
      })
    );
    await waitFor(() => expect(document.activeElement).toBe(notes));
    expect((notes as HTMLInputElement).value).toBe("Unsaved notes");
    fireEvent.click(screen.getByRole("button", { name: "Clear errors" }));
    expect(document.querySelector(".admin-form-summary-region")).toBe(region);
    expect(region?.getAttribute("data-state")).toBe("hidden");
    expect(region?.hasAttribute("inert")).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("returns focus to the close control when keeping unsaved edits", async () => {
    render(<Harness />);
    edit();
    const close = screen.getByRole("button", { name: "Close editor" });
    close.focus();
    fireEvent.click(close);
    fireEvent.click(
      await screen.findByRole("button", { name: "Keep editing" })
    );
    await waitFor(() => expect(document.activeElement).toBe(close));
  });
  it("compares nested fields and arrays without returning their values", () => {
    expect(
      changedFormFields(
        { secret: "old", protocols: [{ port: 1 }] },
        { secret: "new", protocols: [{ port: 2 }] }
      )
    ).toEqual(["secret", "protocols.0.port"]);
    expect(changedFormFields({ a: { b: 1 } }, { a: { b: 1 } })).toEqual([]);
    expect(
      formErrorEntries({
        protocols: [{ port: { type: "min", message: "Invalid port" } }],
      })
    ).toEqual([{ name: "protocols.0.port", message: "Invalid port" }]);
  });
  it("protects close and unload and allows keeping edits or explicitly discarding", async () => {
    render(<Harness />);
    edit();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value
    ).toBe("Changed");
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("reviews changed labels without exposing credentials, and prevents double submits", async () => {
    const save = vi.fn(async () => {
      /* No-op successful fixture. */
    });
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<Harness save={save} />);
    edit();
    fireEvent.change(screen.getByLabelText("Private key"), {
      target: { value: "another-private-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const review = await screen.findByRole("alertdialog");
    expect(review.textContent).toContain("Name");
    expect(review.textContent).toContain("Private key");
    expect(review.textContent).not.toContain("another-private-secret");
    expect(review.textContent).not.toContain("private-key-do-not-display");
    expect(save).not.toHaveBeenCalled();
    const confirm = within(review).getByRole("button", {
      name: "Confirm save",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(storage).not.toHaveBeenCalled();
  });
  it("keeps all input and allows retry after a rejected save", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    render(<Harness save={save} />);
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm save" })
    );
    await screen.findByRole("alert");
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value
    ).toBe("Changed");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm save" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("shows a linked error summary before review", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    fireEvent.click(
      within(alert).getByRole("button", { name: "Name: Name is required" })
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Name" })
      )
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("blocks route navigation until the administrator explicitly discards", async () => {
    const root = createRootRoute({ component: Outlet });
    const editor = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: Harness,
    });
    const destination = createRoute({
      getParentRoute: () => root,
      path: "/other",
      component: () => <h1>Other page</h1>,
    });
    window.location.hash = "#/";
    const history = createHashHistory();
    const router = createRouter({
      routeTree: root.addChildren([editor, destination]),
      history,
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole("textbox", { name: "Name" });
    edit();
    router.history.push("/other");
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.state.location.pathname).toBe("/");
    router.history.push("/other");
    fireEvent.click(
      await screen.findByRole("button", { name: "Discard changes" })
    );
    await screen.findByRole("heading", { name: "Other page" });
    history.destroy();
  });
  it("blocks navigation during a write, then closes the routed editor after one successful save", async () => {
    let finishWrite!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    const root = createRootRoute({ component: Outlet });
    function RoutedEditor() {
      const navigate = useNavigate();
      return <Harness close={() => navigate({ to: "/" })} save={save} />;
    }
    const editor = createRoute({
      getParentRoute: () => root,
      path: "/edit",
      component: RoutedEditor,
    });
    const list = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => <h1>Server list</h1>,
    });
    window.location.hash = "#/edit";
    const history = createHashHistory();
    const router = createRouter({
      routeTree: root.addChildren([editor, list]),
      history,
    });
    try {
      render(<RouterProvider router={router} />);
      await screen.findByRole("textbox", { name: "Name" });
      edit();
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Confirm save" })
      );
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      router.history.push("/");
      await waitFor(() =>
        expect(router.history.location.pathname).toBe("/edit")
      );
      expect(router.state.location.pathname).toBe("/edit");
      fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(save).toHaveBeenCalledTimes(1);
      expect(
        (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement)
          .value
      ).toBe("Changed");
      finishWrite();
      await screen.findByRole("heading", { name: "Server list" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(save).toHaveBeenCalledTimes(1);
    } finally {
      history.destroy();
    }
  });
  it("retains saved values while an asynchronous close is pending", async () => {
    let finishClose!: () => void;
    const close = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        })
    );
    render(<Harness close={close} />);
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm save" })
    );
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value
    ).toBe("Changed");
    finishClose();
  });
  it("closes a route-owned editor after a single explicit discard confirmation", async () => {
    const root = createRootRoute({ component: Outlet });
    function RoutedEditor() {
      const navigate = useNavigate();
      return <Harness close={() => navigate({ to: "/" })} />;
    }
    const editor = createRoute({
      getParentRoute: () => root,
      path: "/edit",
      component: RoutedEditor,
    });
    const list = createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => <h1>Server list</h1>,
    });
    window.location.hash = "#/edit";
    const history = createHashHistory();
    const router = createRouter({
      routeTree: root.addChildren([editor, list]),
      history,
    });
    try {
      render(<RouterProvider router={router} />);
      await screen.findByRole("textbox", { name: "Name" });
      edit();
      fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Discard changes" })
      );
      await screen.findByRole("heading", { name: "Server list" });
      expect(screen.queryByRole("alertdialog")).toBeNull();
    } finally {
      history.destroy();
    }
  });
});
