// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArrayInput } from "@workspace/ui/composed/dynamic-Inputs";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
afterEach(cleanup);
function Harness() {
  const [value, setValue] = useState([{ name: "First" }, { name: "Second" }]);
  return (
    <ArrayInput
      fields={[{ name: "name", type: "text", "aria-label": "Item" }]}
      isReverse
      onChange={setValue}
      value={value}
    />
  );
}
it("retains the neighboring control and focuses it after removal, then focuses a new row", () => {
  render(<Harness />);
  const second = screen.getAllByRole("textbox")[1]!;
  fireEvent.click(screen.getAllByRole("button", { name: "Remove item" })[0]!);
  expect(screen.getByRole("textbox")).toBe(second);
  expect(document.activeElement).toBe(second);
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(screen.getAllByRole("textbox")[1]).toBe(second);
  expect(document.activeElement).toBe(screen.getAllByRole("textbox")[0]);
});
