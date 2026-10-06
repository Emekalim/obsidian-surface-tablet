import { describe, expect, it, vi } from "vitest";
import { CanvasPanController, type CanvasViewport } from "../src/canvas-pan-controller";

describe("CanvasPanController", () => {
  it("moves the Canvas viewport by the pen drag delta", () => {
    const markViewportChanged = vi.fn();
    const viewport: CanvasViewport = { tx: 100, ty: 200, markViewportChanged };
    const controller = new CanvasPanController();

    expect(controller.pan(viewport, 12, -8)).toBe(true);
    expect(viewport.tx).toBe(112);
    expect(viewport.ty).toBe(192);
    expect(markViewportChanged).toHaveBeenCalledOnce();
  });

  it("fails closed when private Canvas viewport fields are unavailable", () => {
    const controller = new CanvasPanController();
    expect(controller.pan({ tx: Number.NaN, ty: 0, markViewportChanged: vi.fn() }, 5, 5)).toBe(
      false,
    );
  });
});
