// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber, DashboardFadeThrough } from "./dashboard-motion";

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

  it("can render unrelated category totals without counting up from zero", () => {
    const view = render(<AnimatedNumber animateOnMount={false} value={96} />);
    const animated = view.container.querySelector(
      "[data-dashboard-animated-number] [aria-hidden='true']"
    );

    expect(animated?.textContent).toBe("96");
  });

  it("settles rapid category changes on the latest fade-through panel", async () => {
    const view = render(
      <DashboardFadeThrough transitionKey="nodes">
        <span>Nodes ranking</span>
      </DashboardFadeThrough>
    );

    view.rerender(
      <DashboardFadeThrough transitionKey="users">
        <span>Users ranking</span>
      </DashboardFadeThrough>
    );
    view.rerender(
      <DashboardFadeThrough transitionKey="nodes">
        <span>Nodes ranking</span>
      </DashboardFadeThrough>
    );
    view.rerender(
      <DashboardFadeThrough transitionKey="users">
        <span>Users ranking</span>
      </DashboardFadeThrough>
    );

    await waitFor(
      () => {
        const panels = view.container.querySelectorAll(
          "[data-dashboard-transition-key]"
        );
        expect(panels).toHaveLength(1);
        expect(panels[0]?.getAttribute("data-dashboard-transition-key")).toBe(
          "users"
        );
      },
      { timeout: 1200 }
    );
  });
});
