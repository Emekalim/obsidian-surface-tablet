import { describe, expect, it, vi } from "vitest";
import { CanvasPanController, type CanvasViewport } from "../src/canvas-pan-controller";

describe("CanvasPanController", () => {
  it("uses natural panning by default", () => {
    const markViewportChanged = vi.fn();
    const viewport: CanvasViewport = { tx: 100, ty: 200, markViewportChanged };
    const controller = new CanvasPanController();

    expect(controller.pan(viewport, 12, -8, true)).toBe(true);
    expect(viewport.tx).toBe(88);
    expect(viewport.ty).toBe(208);
    expect(markViewportChanged).toHaveBeenCalledOnce();
  });

  it("supports direct panning in the pen movement direction", () => {
    const viewport: CanvasViewport = { tx: 100, ty: 200, markViewportChanged: vi.fn() };
    const controller = new CanvasPanController();

    expect(controller.pan(viewport, 12, -8, false)).toBe(true);
    expect(viewport.tx).toBe(112);
    expect(viewport.ty).toBe(192);
  });

  it("fails closed when private Canvas viewport fields are unavailable", () => {
    const controller = new CanvasPanController();
    expect(
      controller.pan({ tx: Number.NaN, ty: 0, markViewportChanged: vi.fn() }, 5, 5, true),
    ).toBe(false);
  });
});
