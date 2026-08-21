// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ErrorState,
  LoadingState,
  NotFoundState,
  PermissionDeniedState,
} from "./states";

afterEach(cleanup);

describe("admin state components", () => {
  it("runs the retry action from the error state", () => {
    const onRetry = vi.fn();

    render(
      <ErrorState
        description="The request failed"
        onRetry={onRetry}
        retryLabel="Try again"
        title="Unable to load data"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("exposes loading progress to assistive technology", () => {
    render(<LoadingState label="Loading servers" rows={3} />);

    const loading = screen.getByRole("status", { name: "Loading servers" });
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.children).toHaveLength(3);
  });

  it("renders permission and not-found actions", () => {
    render(
      <>
        <PermissionDeniedState
          action={<button type="button">Request access</button>}
          title="Permission denied"
        />
        <NotFoundState
          action={<button type="button">Back to list</button>}
          title="Not found"
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Request access" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to list" })).toBeTruthy();
  });
});
