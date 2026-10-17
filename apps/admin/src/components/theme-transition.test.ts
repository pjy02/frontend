// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import type { Theme } from "@workspace/ui/integrations/theme";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThemeTransition, themeRevealGeometry } from "./theme-transition";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function browserTransitions() {
  const entries: ReturnType<typeof entry>[] = [];
  function entry(update: () => void | Promise<void>) {
    const updated = deferred(),
      ready = deferred(),
      finished = deferred();
    let ran = false;
    let skipped = false;
    const run = async () => {
      if (ran) return;
      ran = true;
      try {
        await update();
        updated.resolve();
        if (skipped) finished.resolve();
        else ready.resolve();
      } catch (error) {
        updated.reject(error);
        ready.reject(error);
        finished.reject(error);
      }
    };
    const transition = {
      updateCallbackDone: updated.promise,
      ready: ready.promise,
      finished: finished.promise,
      skipTransition: vi.fn(() => {
        if (skipped) return;
        skipped = true;
        ready.reject(new Error("Skipped"));
        run().then(() => finished.resolve());
      }),
    };
    return { run, transition, finished };
  }
  const start = vi.fn((update: () => void) => {
    const next = entry(update);
    entries.push(next);
    return next.transition;
  });
  const animations: ReturnType<typeof deferred>[] = [];
  const animate = vi.fn(
    (_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
      const animation = deferred();
      animations.push(animation);
      const current = entries.at(-1)!;
      animation.promise.then(
        () => current.finished.resolve(),
        () => current.finished.resolve()
      );
      return {
        finished: animation.promise,
        cancel: vi.fn(() => animation.reject(new Error("Cancelled"))),
      };
    }
  );
  vi.stubGlobal("CSS", { supports: () => true });
  vi.spyOn(document, "startViewTransition").mockImplementation(
    start as unknown as Document["startViewTransition"]
  );
  vi.spyOn(document.documentElement, "animate").mockImplementation(
    animate as unknown as Element["animate"]
  );
  return { start, animate, entries, animations };
}

let controllers: ReturnType<typeof createThemeTransition>[] = [];
beforeEach(() => {
  document.documentElement.className = "admin-console light";
  document.documentElement.style.colorScheme = "light";
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  // jsdom does not implement these browser APIs.
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: () => {
      /* Browser API placeholder, replaced by each fixture. */
    },
  });
  Object.defineProperty(document.documentElement, "animate", {
    configurable: true,
    writable: true,
    value: () => {
      /* Browser API placeholder, replaced by each fixture. */
    },
  });
});
afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers = [];
  document.body.replaceChildren();
  delete document.documentElement.dataset.themeReveal;
  delete document.documentElement.dataset.themeCapture;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture() {
  const browser = browserTransitions();
  const commit = vi.fn((next: Theme) => {
    const resolved = next === "system" ? "light" : next;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.classList.toggle("light", resolved === "light");
    document.documentElement.style.colorScheme = resolved;
  });
  const settings = {
    reduced: false,
    duration: 420,
    easing: "cubic-bezier(0.2,0,0,1)",
  };
  const controller = createThemeTransition(commit, () => settings);
  controllers.push(controller);
  const trigger = document.createElement("button");
  document.body.append(trigger);
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
    new DOMRect(900, 10, 36, 36)
  );
  return { ...browser, controller, commit, settings, trigger };
}

describe("Admin theme reveal", () => {
  it("covers all viewport corners using the trigger's center", () => {
    const geometry = themeRevealGeometry(
      new DOMRect(350, 10, 36, 36),
      390,
      844
    );
    expect(geometry.x).toBe(368);
    expect(geometry.y).toBe(28);
    for (const x of [0, 390])
      for (const y of [0, 844]) {
        expect(geometry.radius).toBeGreaterThan(
          Math.hypot(x - geometry.x, y - geometry.y)
        );
      }
  });
  it("commits once before animating the new root snapshot and cleans up", async () => {
    const f = fixture();
    const changed = f.controller.change("dark", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    expect(f.commit).not.toHaveBeenCalled();
    await f.entries[0]!.run();
    await changed;
    await waitFor(() => expect(f.animate).toHaveBeenCalledTimes(1));
    expect(f.commit).toHaveBeenCalledExactlyOnceWith("dark");
    expect(f.animate.mock.calls[0]).toEqual([
      [
        expect.objectContaining({ clipPath: "circle(0px at 918px 28px)" }),
        expect.objectContaining({
          clipPath: expect.stringMatching(/^circle\(\d+px at 918px 28px\)$/),
        }),
      ],
      expect.objectContaining({
        duration: 420,
        pseudoElement: "::view-transition-new(root)",
      }),
    ]);
    expect(document.documentElement.dataset.themeCapture).toBeUndefined();
    f.animations[0]!.resolve();
    await waitFor(() =>
      expect(document.documentElement.dataset.themeReveal).toBeUndefined()
    );
  });
  it("reveals outward in both directions, without an old-image shrinking animation", async () => {
    const f = fixture();
    document.documentElement.className = "admin-console dark";
    const changed = f.controller.change("light", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    await f.entries[0]!.run();
    await changed;
    expect(f.animate.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clipPath: "circle(0px at 918px 28px)" }),
      ])
    );
    expect(f.commit).toHaveBeenCalledExactlyOnceWith("light");
  });
  it("never commits an obsolete callback after rapid changes", async () => {
    const f = fixture();
    const first = f.controller.change("dark", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    const second = f.controller.change("light", f.trigger);
    const latest = f.controller.change("system", f.trigger);
    await Promise.all([first, second, latest]);
    expect(f.commit).toHaveBeenCalledExactlyOnceWith("system");
    expect(f.animate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.documentElement.dataset.themeReveal).toBeUndefined()
    );
  });
  it("interrupts an in-progress reveal and commits the latest target", async () => {
    const f = fixture();
    const first = f.controller.change("dark", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    await f.entries[0]!.run();
    await first;
    const second = f.controller.change("light", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(2));
    await f.entries[1]!.run();
    await second;
    expect(f.entries[0]!.transition.skipTransition).toHaveBeenCalled();
    expect(f.commit.mock.calls.map(([theme]) => theme)).toEqual([
      "dark",
      "light",
    ]);
    f.animations.at(-1)!.resolve();
    await waitFor(() =>
      expect(document.documentElement.dataset.themeReveal).toBeUndefined()
    );
  });
  it.each([
    "reduced",
    "unsupported",
    "hidden",
    "detached",
    "same",
    "system",
  ])("uses a direct update for %s without snapshots", async (mode) => {
    const f = fixture();
    if (mode === "reduced") f.settings.reduced = true;
    if (mode === "unsupported")
      Object.defineProperty(document, "startViewTransition", {
        value: undefined,
      });
    if (mode === "hidden")
      vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    if (mode === "detached") f.trigger.remove();
    const next =
      mode === "same" ? "light" : mode === "system" ? "system" : "dark";
    await f.controller.change(next, f.trigger);
    expect(f.commit).toHaveBeenCalledExactlyOnceWith(next);
    expect(f.start).not.toHaveBeenCalled();
    expect(f.animate).not.toHaveBeenCalled();
  });
  it("falls back if snapshot creation or animation fails", async () => {
    const f = fixture();
    f.start.mockImplementationOnce(() => {
      throw new Error("Unavailable");
    });
    await f.controller.change("dark", f.trigger);
    expect(f.commit).toHaveBeenCalledExactlyOnceWith("dark");
    expect(document.documentElement.dataset.themeReveal).toBeUndefined();
    f.animate.mockImplementationOnce(() => {
      throw new Error("No pseudo-element animation");
    });
    const next = f.controller.change("light", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(2));
    await f.entries[0]!.run();
    await next;
    await waitFor(() =>
      expect(document.documentElement.dataset.themeReveal).toBeUndefined()
    );
    expect(f.commit).toHaveBeenLastCalledWith("light");
  });
  it("cancels only the visual on resize/route/visibility cancellation, keeping the chosen theme", async () => {
    const f = fixture();
    const changed = f.controller.change("dark", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    f.controller.cancelVisual();
    await changed;
    expect(f.commit).toHaveBeenCalledExactlyOnceWith("dark");
    expect(f.animate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.documentElement.dataset.themeReveal).toBeUndefined()
    );
  });
  it("does not commit after disposal", async () => {
    const f = fixture();
    const pending = f.controller.change("dark", f.trigger);
    f.controller.dispose();
    await pending;
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("interrupts a real snapshot hit only inside the original theme icon", async () => {
    const f = fixture();
    const changed = f.controller.change("dark", f.trigger);
    await waitFor(() => expect(f.start).toHaveBeenCalledTimes(1));
    await f.entries[0]!.run();
    await changed;
    const event = {
      target: document.documentElement,
      isPrimary: true,
      button: 0,
      ctrlKey: false,
      clientX: 918,
      clientY: 28,
    } as unknown as PointerEvent;
    expect(
      f.controller.interruptPointer({ ...event, clientX: 10 } as PointerEvent)
    ).toBeUndefined();
    expect(
      f.controller.interruptPointer({
        ...event,
        isPrimary: false,
      } as PointerEvent)
    ).toBeUndefined();
    expect(f.entries[0]!.transition.skipTransition).not.toHaveBeenCalled();
    expect(f.controller.interruptPointer(event)).toBe(f.trigger);
    expect(f.entries[0]!.transition.skipTransition).toHaveBeenCalled();
  });
});
