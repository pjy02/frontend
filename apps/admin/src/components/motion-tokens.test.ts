import { readFileSync } from "node:fs";
import {
  motionCssVariables,
  resolveMotion,
} from "@workspace/ui/lib/motion-profile";
import { describe, expect, it } from "vitest";
import { adminMotionProfile } from "./motion-tokens";

describe("Admin semantic motion profile", () => {
  it("keeps press immediate, exit shorter and state presets free of displacement", () => {
    expect(adminMotionProfile.press.duration).toBeLessThan(
      adminMotionProfile.state.duration
    );
    for (const [enter, exit] of [
      ["menuEnter", "menuExit"],
      ["dialogEnter", "dialogExit"],
      ["overlayEnter", "overlayExit"],
      ["dataEnter", "dataExit"],
      ["categoryEnter", "categoryExit"],
    ] as const) {
      expect(adminMotionProfile[exit].duration).toBeLessThanOrEqual(
        adminMotionProfile[enter].duration
      );
    }
    for (const token of Object.values(adminMotionProfile)) {
      if (token.kind === "state") {
        expect(token.distance ?? 0).toBe(0);
        expect(token.scale ?? 1).toBe(1);
      }
    }
  });

  it("uses the same duration, easing and geometry in CSS and Motion", () => {
    const profile = {
      ...adminMotionProfile,
      menuEnter: {
        ...adminMotionProfile.menuEnter,
        duration: 240,
        distance: 7,
      },
    };
    const css = motionCssVariables(profile, false, "--admin-motion");
    const js = resolveMotion(profile, false);
    expect(css["--admin-motion-menu-enter-duration"]).toBe("240ms");
    expect(js.menuEnter.transition.duration).toBe(0.24);
    expect(css["--admin-motion-menu-enter-distance"]).toBe(
      `${js.menuEnter.distance}px`
    );
    expect(css["--admin-motion-menu-enter-ease"]).toBe(
      `cubic-bezier(${js.menuEnter.transition.ease.join(", ")})`
    );
    expect(js.menuEnter.kind).toBe("spatial");
    expect(js.state.kind).toBe("state");
  });

  it("removes delays, spatial changes and timelines for every reduced preset", () => {
    const js = resolveMotion(adminMotionProfile, true);
    const css = motionCssVariables(adminMotionProfile, true, "--admin-motion");
    for (const token of Object.values(js)) {
      expect(token.transition.duration).toBe(0);
      expect(token.transition.delay).toBe(0);
      expect(token.distance).toBe(0);
      expect(token.scale).toBe(1);
    }
    expect(css["--admin-motion-menu-level-duration"]).toBe("0ms");
    expect(css["--admin-motion-category-enter-delay"]).toBe("0ms");
  });

  it("does not leave an Admin CSS motion variable without a source", () => {
    const theme = readFileSync(
      new URL("../styles/admin-theme.css", import.meta.url),
      "utf8"
    );
    const dashboard = readFileSync(
      new URL("../sections/dashboard/dashboard.css", import.meta.url),
      "utf8"
    );
    const css = `${theme}\n${dashboard}`;
    const supplied = new Set([
      ...Object.keys(
        motionCssVariables(adminMotionProfile, false, "--admin-motion")
      ),
      ...Array.from(
        css.matchAll(/(--admin-motion-[\w-]+)\s*:/g),
        (match) => match[1]
      ),
    ]);
    const missing = Array.from(
      css.matchAll(/var\((--admin-motion-[\w-]+)/g),
      (match) => match[1]
    ).filter((name) => !supplied.has(name));
    expect(missing).toEqual([]);
  });
});
