/** Feature-detected subset of Obsidian's private Canvas viewport implementation. */
export interface CanvasViewport {
  tx: number;
  ty: number;
  markViewportChanged: () => void;
}

/** Applies direct viewport movement after native pen/right-drag handling proves insufficient. */
export class CanvasPanController {
  pan(viewport: CanvasViewport | null, deltaX: number, deltaY: number): boolean {
    if (
      !viewport ||
      !Number.isFinite(viewport.tx) ||
      !Number.isFinite(viewport.ty) ||
      !Number.isFinite(deltaX) ||
      !Number.isFinite(deltaY) ||
      typeof viewport.markViewportChanged !== "function"
    ) {
      return false;
    }

    viewport.tx += deltaX;
    viewport.ty += deltaY;
    viewport.markViewportChanged();
    return true;
  }
}
