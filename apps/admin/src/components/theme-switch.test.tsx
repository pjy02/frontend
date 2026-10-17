// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeSwitch } from "@workspace/ui/composed/theme-switch";
import { ThemeProvider, useTheme } from "@workspace/ui/integrations/theme";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
beforeEach(() => {
  document.cookie = "theme=; Max-Age=0; path=/";
  document.documentElement.className = "light";
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "theme=; Max-Age=0; path=/";
});

it.each([
  false,
  true,
])("keeps shared effect updates by default and enables synchronous capture only with opt-in (%s)", async (synchronousUpdates) => {
  const seen: string[] = [];
  function Probe() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    return (
      <button
        onClick={() => {
          setTheme("dark");
          seen.push(document.documentElement.style.colorScheme);
        }}
        type="button"
      >
        {theme}/{resolvedTheme}
      </button>
    );
  }
  render(
    <ThemeProvider defaultTheme="light" synchronousUpdates={synchronousUpdates}>
      <Probe />
    </ThemeProvider>
  );
  fireEvent.click(screen.getByRole("button"));
  expect(seen).toEqual([synchronousUpdates ? "dark" : "light"]);
  await screen.findByText("dark/dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(document.cookie).toContain("theme=dark");
});

it("preserves the shared switch's direct update when Admin does not opt in", async () => {
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeSwitch />
    </ThemeProvider>
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Toggle theme" }), {
    key: "Enter",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Dark" }));
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  );
  expect(screen.queryByRole("menu")).toBeNull();
});

it("defers the Admin handler until the menu exits and passes the original focused trigger", async () => {
  const selected = vi.fn(
    (_theme: string, trigger: HTMLButtonElement | null) => {
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    }
  );
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeSwitch onThemeSelect={selected} />
    </ThemeProvider>
  );
  const trigger = screen.getByRole("button", { name: "Toggle theme" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Dark" }));
  await waitFor(() =>
    expect(selected).toHaveBeenCalledExactlyOnceWith("dark", trigger)
  );
  expect(document.documentElement.classList.contains("light")).toBe(true);
});

it("does not request a theme change when the menu is dismissed", async () => {
  const selected = vi.fn();
  render(
    <ThemeProvider defaultTheme="light">
      <ThemeSwitch onThemeSelect={selected} />
    </ThemeProvider>
  );
  const trigger = screen.getByRole("button", { name: "Toggle theme" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.keyDown(await screen.findByRole("menu"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(selected).not.toHaveBeenCalled();
});
