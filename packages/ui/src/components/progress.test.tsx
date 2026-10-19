// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Progress } from "./progress";

afterEach(cleanup);
describe("continuous progress semantics", () => {
  it.each([
    9, 45.5, 100,
  ])("exposes exact %s percent to both pixels and accessibility", (value) => {
    const { container } = render(<Progress aria-label="CPU" value={value} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      String(value)
    );
    expect(
      container.querySelector<HTMLElement>('[data-slot="progress-indicator"]')
        ?.style.transform
    ).toBe(`translateX(-${100 - value}%)`);
  });
  it("keeps unknown indeterminate, clamps known out-of-range values and respects custom max", () => {
    const view = render(<Progress aria-label="Availability" value={null} />);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(
      false
    );
    view.rerender(<Progress aria-label="Availability" max={200} value={300} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "200"
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe(
      "200"
    );
  });
});
