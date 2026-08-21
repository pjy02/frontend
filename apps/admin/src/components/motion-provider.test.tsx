// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider, useAdminMotion } from "./motion-provider";

function Probe() {
  const { reducedMotion } = useAdminMotion();
  return <output>{reducedMotion ? "reduced" : "full"}</output>;
}

describe("MotionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.motion;
  });

  it("publishes the system motion preference to React and CSS", () => {
    let matches = false;
    const listeners = new Set<() => void>();

    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      get matches() {
        return matches;
      },
      media: query,
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    }));

    const view = render(
      <MotionProvider>
        <Probe />
      </MotionProvider>
    );

    expect(screen.getByText("full")).toBeTruthy();
    expect(document.documentElement.dataset.motion).toBe("full");

    act(() => {
      matches = true;
      for (const listener of listeners) listener();
    });

    expect(screen.getByText("reduced")).toBeTruthy();
    expect(document.documentElement.dataset.motion).toBe("reduced");

    view.unmount();
    expect(listeners.size).toBe(0);
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });
});
