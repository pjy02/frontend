// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { SortableMobileCard } from "@workspace/ui/composed/pro-table/sortable-mobile-card";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    isDragging: true,
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: { x: 12, y: 180, scaleX: 1, scaleY: 1 },
    transition: undefined,
  }),
}));
afterEach(cleanup);

it("lets DndKit own the card transform while Motion only animates opacity", async () => {
  const { container } = render(
    <SortableMobileCard dragLabel="Reorder" id="1" label="Node" motionEnabled>
      Node address
    </SortableMobileCard>
  );
  await waitFor(() => {
    const card = container.querySelector("article") as HTMLElement;
    expect(card.style.transform).toContain("180px");
    expect(card.style.transform).not.toContain("12px");
  });
});
