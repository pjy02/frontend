// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "./dashboard-motion";

const motionPreference = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock("@/components/motion-provider", () => ({
  useAdminMotion: () => motionPreference,
}));

afterEach(() => {
  cleanup();
  motionPreference.reducedMotion = false;
});

describe("dashboard metric motion", () => {
  it("animates from the rendered value to the next value", async () => {
    const view = render(
      <AnimatedNumber
        format={(value) => String(Math.round(value))}
        value={120}
      />
    );
    const animated = view.container.querySelector(
      "[data-dashboard-animated-number] [aria-hidden='true']"
    );

    expect(animated?.textContent).toBe("0");
    await waitFor(() => expect(animated?.textContent).toBe("120"), {
      timeout: 1200,
    });

    view.rerender(
      <AnimatedNumber
        format={(value) => String(Math.round(value))}
        value={240}
      />
    );
    expect(animated?.textContent).toBe("120");
    await waitFor(() => expect(animated?.textContent).toBe("240"), {
      timeout: 1200,
    });
  });

  it("updates immediately when reduced motion is enabled", () => {
    motionPreference.reducedMotion = true;
    const view = render(<AnimatedNumber value={75} />);
    const animated = view.container.querySelector(
      "[data-dashboard-animated-number] [aria-hidden='true']"
    );

    expect(animated?.textContent).toBe("75");
  });
});
