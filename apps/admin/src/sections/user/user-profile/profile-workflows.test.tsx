// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "@/components/motion-provider";
import { AuthMethodsForm } from "./auth-methods-form";
import { NotifySettingsForm } from "./notify-settings-form";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@workspace/ui/services/admin/admin", () => ({
  putUserNotify: mocks.notify,
  postUserAuthMethod: mocks.add,
  putUserAuthMethod: mocks.update,
  deleteUserAuthMethod: mocks.remove,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
const user = {
  id: 7,
  enable_balance_notify: false,
  enable_login_notify: false,
  enable_subscribe_notify: false,
  enable_trade_notify: false,
  auth_methods: [
    {
      auth_type: "email",
      auth_identifier: "original@example.com",
      verified: true,
    },
    { auth_type: "google", auth_identifier: "Google ID", verified: true },
  ],
} as API.User;
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        /* jsdom has no layout. */
      }
      unobserve() {
        /* jsdom has no layout. */
      }
      disconnect() {
        /* jsdom has no layout. */
      }
    }
  );
  for (const mock of Object.values(mocks))
    mock.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("profile tabs and writes", () => {
  it("retains notification and credential drafts across preserved tabs", async () => {
    render(
      <MotionProvider>
        <Tabs defaultValue="notify" preserveContent>
          <TabsList>
            <TabsTrigger value="notify">Notify</TabsTrigger>
            <TabsTrigger value="auth">Auth</TabsTrigger>
          </TabsList>
          <TabsContent value="notify">
            <NotifySettingsForm refetch={mocks.read} user={user} />
          </TabsContent>
          <TabsContent value="auth">
            <AuthMethodsForm refetch={mocks.read} user={user} />
          </TabsContent>
        </Tabs>
      </MotionProvider>
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Balance Notifications" })
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Auth" }), {
      button: 0,
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "draft@example.com" },
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Notify" }), {
      button: 0,
    });
    expect(
      screen
        .getByRole("switch", { name: "Balance Notifications" })
        .getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Auth" }), {
      button: 0,
    });
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "draft@example.com"
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps a failed notification save and retries without reviewing ordinary preferences", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("offline"));
    render(<NotifySettingsForm refetch={mocks.read} user={user} />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Balance Notifications" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(
      screen
        .getByRole("switch", { name: "Balance Notifications" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(2));
    expect(mocks.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: 7, enable_balance_notify: true })
    );
  });
  it("reviews credentials, distinguishes failed writes from failed synchronization and retries only reads", async () => {
    mocks.update.mockRejectedValueOnce(new Error("write failed"));
    render(<AuthMethodsForm refetch={mocks.read} user={user} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    const review = await screen.findByRole("alertdialog");
    expect(review.textContent).not.toContain("new@example.com");
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(
      within(review).getByRole("button", { name: "Confirm save" })
    );
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "new@example.com"
    );
    mocks.read.mockRejectedValueOnce(new Error("read failed"));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm save" })
    );
    await screen.findByText("Saved. Refresh failed; do not submit again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it("requires confirmation to remove a credential and leaves the confirmation open on failure", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("denied"));
    render(
      <MotionProvider>
        <AuthMethodsForm refetch={mocks.read} user={user} />
      </MotionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(mocks.read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.read).toHaveBeenCalledOnce();
  });
});
