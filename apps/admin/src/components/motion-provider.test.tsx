// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { useMotionProfile } from "@workspace/ui/components/motion-profile";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider, useAdminMotion } from "./motion-provider";
import { adminMotionProfile } from "./motion-tokens";

function Probe() {
  const { reducedMotion } = useAdminMotion();
  return <output>{reducedMotion ? "reduced" : "full"}</output>;
}

describe("MotionProvider", () => {
  afterEach(() => {
    cleanup();
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
    expect(
      document.documentElement.style.getPropertyValue(
        "--admin-motion-menu-enter-duration"
      )
    ).toBe("160ms");

    act(() => {
      matches = true;
      for (const listener of listeners) listener();
    });

    expect(screen.getByText("reduced")).toBeTruthy();
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(
      document.documentElement.style.getPropertyValue(
        "--admin-motion-menu-enter-duration"
      )
    ).toBe("0ms");

    view.unmount();
    expect(listeners.size).toBe(0);
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue(
        "--admin-motion-menu-enter-duration"
      )
    ).toBe("");
  });

  it("updates CSS and consumers together and restores owned root properties", () => {
    function PresetProbe() {
      const settings = useMotionProfile();
      return (
        <output>
          {settings ? settings.presets.menuEnter.durationMs : "not enabled"}
        </output>
      );
    }
    const root = document.documentElement;
    root.style.setProperty("--admin-motion-menu-enter-duration", "77ms");
    const view = render(
      <MotionProvider>
        <PresetProbe />
      </MotionProvider>
    );
    expect(screen.getByText("160")).toBeTruthy();
    const profile = {
      ...adminMotionProfile,
      menuEnter: { ...adminMotionProfile.menuEnter, duration: 250 },
    };
    view.rerender(
      <MotionProvider profile={profile}>
        <PresetProbe />
      </MotionProvider>
    );
    expect(screen.getByText("250")).toBeTruthy();
    expect(
      root.style.getPropertyValue("--admin-motion-menu-enter-duration")
    ).toBe("250ms");
    view.unmount();
    expect(
      root.style.getPropertyValue("--admin-motion-menu-enter-duration")
    ).toBe("77ms");
    root.style.removeProperty("--admin-motion-menu-enter-duration");
    render(<PresetProbe />);
    expect(screen.getByText("not enabled")).toBeTruthy();
    expect(
      root.style.getPropertyValue("--admin-motion-menu-enter-duration")
    ).toBe("");
  });
});
