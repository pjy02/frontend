// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";
import { useFormSafety } from "./form-safety";
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
afterEach(cleanup);
function Editor() {
  const [open, setOpen] = useState(false);
  const form = useForm({ defaultValues: { name: "Original" } });
  const safety = useFormSafety({ form, open, onOpenChange: setOpen });
  return (
    <WorkspaceDialog onOpenChange={safety.requestOpenChange} open={open}>
      <Button onClick={() => setOpen(true)}>Edit row</Button>
      <WorkspaceDialogContent aria-describedby={undefined}>
        <WorkspaceDialogTitle>Row editor</WorkspaceDialogTitle>
        <Form {...form}>
          <form>
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
                </FormItem>
              )}
            />
          </form>
        </Form>
      </WorkspaceDialogContent>
      {safety.dialogs}
    </WorkspaceDialog>
  );
}
it("preserves an open row form during a table refresh and parent rerender", async () => {
  const action = { current: null as ProTableActions | null };
  const request = async () => ({ list: [{ id: 7, name: "Server" }], total: 1 });
  const table = () => (
    <ProTable
      action={action}
      actions={{ render: () => [<Editor key="editor" />] }}
      columns={[{ accessorKey: "name", header: "Name" }]}
      mobile={false}
      request={request}
    />
  );
  const view = render(table());
  fireEvent.click(await screen.findByRole("button", { name: "Edit row" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Unsaved edit" },
  });
  await act(async () => {
    await action.current?.refresh();
  });
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  view.rerender(table());
  expect(
    (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value
  ).toBe("Unsaved edit");
});
