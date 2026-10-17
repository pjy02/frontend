// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminRouteContent } from "./route-content";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
afterEach(cleanup);

it("keeps the mounted shell visible while a cold page suspends, then recovers", async () => {
  let ready = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  function ColdPage() {
    if (!ready) throw pending;
    return <h1>Nodes</h1>;
  }
  const shell = (cold: boolean) => (
    <Suspense fallback={<p>Application loading</p>}>
      <aside>Navigation</aside>
      <header>Header</header>
      <main>
        <AdminRouteContent>
          {cold ? <ColdPage /> : <h1>Servers</h1>}
        </AdminRouteContent>
      </main>
    </Suspense>
  );
  const view = render(shell(false));
  const sidebar = screen.getByText("Navigation");
  view.rerender(shell(true));
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("Application loading")).toBeNull();
  expect(sidebar.style.display).not.toBe("none");
  expect(screen.getByText("Header").style.display).not.toBe("none");
  ready = true;
  release();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Nodes" })).toBeTruthy()
  );
  expect(screen.getByText("Navigation")).toBe(sidebar);
});
