// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnimatedNumber,
  DashboardDataTransition,
  DashboardFadeThrough,
  useDashboardCategory,
} from "./dashboard-motion";

const motionPreference = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock("@/components/motion-provider", async () => {
  const { resolveMotion } = await import("@workspace/ui/lib/motion-profile");
  const { adminMotionProfile } = await import("@/components/motion-tokens");
  const full = resolveMotion(adminMotionProfile, false);
  const reduced = resolveMotion(adminMotionProfile, true);
  return {
    useAdminMotion: () => ({
      ...motionPreference,
      presets: motionPreference.reducedMotion ? reduced : full,
    }),
  };
});

afterEach(() => {
  cleanup();
  motionPreference.reducedMotion = false;
});

describe("dashboard metric motion", () => {
  it("changes formatting without restarting an unchanged number", () => {
    motionPreference.reducedMotion = true;
    const view = render(
      <AnimatedNumber format={(value) => `USD ${value}`} value={75} />
    );
    view.rerender(
      <AnimatedNumber format={(value) => `CNY ${value}`} value={75} />
    );
    expect(
      view.container.querySelector('[aria-hidden="true"]')?.textContent
    ).toBe("CNY 75");
    expect(view.container.querySelector(".sr-only")?.textContent).toBe(
      "CNY 75"
    );
  });

  it("settles on the target immediately when reduced motion is enabled during counting", async () => {
    const view = render(
      <AnimatedNumber
        format={(value) => String(Math.round(value))}
        value={1000}
      />
    );
    const visible = () =>
      view.container.querySelector('[aria-hidden="true"]')?.textContent;
    await waitFor(() => expect(Number(visible())).toBeGreaterThan(0));
    motionPreference.reducedMotion = true;
    view.rerender(
      <AnimatedNumber
        format={(value) => String(Math.round(value))}
        value={2000}
      />
    );
    expect(visible()).toBe("2000");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(visible()).toBe("2000");
  });
  it("interrupts number updates at the currently displayed value and heads to the latest target", async () => {
    const number = (value: number) => (
      <AnimatedNumber
        format={(latest) => String(Math.round(latest))}
        value={value}
      />
    );
    const view = render(number(1000));
    const output = view.container.querySelector("[aria-hidden='true']");
    await waitFor(() => {
      const current = Number(output?.textContent);
      expect(current).toBeGreaterThan(0);
      expect(current).toBeLessThan(1000);
    });
    const current = output?.textContent;
    view.rerender(number(2000));
    // React's act may flush another animation frame during rerender. It must
    // continue forward from that value, never restart at zero/the old target.
    expect(Number(output?.textContent)).toBeGreaterThanOrEqual(Number(current));
    view.rerender(number(50));
    expect(output?.textContent).not.toBe("0");
    await waitFor(() => expect(output?.textContent).toBe("50"), {
      timeout: 1200,
    });
  });
  it("shares one category swap and cancels obsolete targets without remounting the stage", async () => {
    function Category({ kind, total }: { kind: string; total: number }) {
      const { value } = useDashboardCategory(kind, { kind, total });
      return (
        <div data-stage>
          <button type="button">{kind}</button>
          <output>
            {value.kind}:{value.total}
          </output>
        </div>
      );
    }
    const view = render(<Category kind="nodes" total={100} />);
    const stage = view.container.querySelector("[data-stage]");
    view.rerender(<Category kind="users" total={200} />);
    expect(view.container.querySelector("output")?.textContent).toBe(
      "nodes:100"
    );
    view.rerender(<Category kind="users" total={250} />);
    view.rerender(<Category kind="nodes" total={110} />);
    view.rerender(<Category kind="users" total={300} />);
    await waitFor(
      () =>
        expect(view.container.querySelector("output")?.textContent).toBe(
          "users:300"
        ),
      { timeout: 1200 }
    );
    expect(view.container.querySelector("[data-stage]")).toBe(stage);
    const output = view.container.querySelector("output");
    view.rerender(<Category kind="users" total={400} />);
    expect(view.container.querySelector("output")).toBe(output);
    expect(output?.textContent).toBe("users:400");
  });

  it("does not remount chart content when a range/state transition key changes", () => {
    const view = render(
      <DashboardDataTransition transitionKey="month">
        <input defaultValue="Keep selection" />
      </DashboardDataTransition>
    );
    const input = view.container.querySelector("input");
    view.rerender(
      <DashboardDataTransition transitionKey="total">
        <input defaultValue="Keep selection" />
      </DashboardDataTransition>
    );
    expect(view.container.querySelector("input")).toBe(input);
  });
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

  it("switches category panels immediately when reduced motion is enabled", async () => {
    motionPreference.reducedMotion = true;
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

    await waitFor(() => {
      const panels = view.container.querySelectorAll(
        "[data-dashboard-transition-key]"
      );
      expect(panels).toHaveLength(1);
      expect(panels[0]?.getAttribute("data-dashboard-transition-key")).toBe(
        "users"
      );
    });
  });
});
