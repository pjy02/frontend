// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { useReducedMotion } from "@workspace/ui/hooks/use-reduced-motion";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

function PreferenceProbe({ onChange }: { onChange: (value: boolean) => void }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    onChange(reducedMotion);
  }, [onChange, reducedMotion]);

  return <output>{String(reducedMotion)}</output>;
}

describe("useReducedMotion", () => {
  it("tracks changes to the system reduced motion preference", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const onChange = vi.fn();

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

    const view = render(<PreferenceProbe onChange={onChange} />);
    expect(screen.getByText("false")).toBeTruthy();

    act(() => {
      matches = true;
      for (const listener of listeners) listener();
    });

    expect(screen.getByText("true")).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(true);

    view.unmount();
    expect(listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
