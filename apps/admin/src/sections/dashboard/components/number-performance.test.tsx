// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AnimatedNumber } from "./dashboard-motion";

vi.mock("@/components/motion-provider", async () => {
  const { resolveMotion } = await import("@workspace/ui/lib/motion-profile");
  const { adminMotionProfile } = await import("@/components/motion-tokens");
  const presets = resolveMotion(adminMotionProfile, false);
  return { useAdminMotion: () => ({ reducedMotion: false, presets }) };
});
afterEach(cleanup);

it("animates 32 numbers without committing a React subtree on every frame", async () => {
  let commits = 0;
  const counters = (value: number) =>
    Array.from({ length: 32 }, (_, index) => (
      <Profiler
        id={String(index)}
        key={index}
        onRender={(_id, phase) => {
          if (phase !== "mount") commits += 1;
        }}
      >
        <AnimatedNumber
          format={(current) => String(Math.round(current))}
          value={value}
        />
      </Profiler>
    ));
  const view = render(counters(1000));
  const values = () =>
    Array.from(view.container.querySelectorAll('[aria-hidden="true"]')).map(
      (node) => node.textContent
    );
  await waitFor(() => expect(values()).toEqual(new Array(32).fill("1000")), {
    timeout: 2200,
  });
  const mountAnimationCommits = commits;
  commits = 0;
  view.rerender(counters(2000));
  await waitFor(() => expect(values()).toEqual(new Array(32).fill("2000")), {
    timeout: 2200,
  });
  console.log("Number animation React commits", {
    mountAnimationCommits,
    updateAnimationCommits: commits,
  });
  expect(mountAnimationCommits).toBeLessThanOrEqual(32);
  expect(commits).toBeLessThanOrEqual(32);
});
