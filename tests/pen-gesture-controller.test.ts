import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasPanController, type CanvasViewport } from "../src/canvas-pan-controller";
import { CanvasTargetRegistry } from "../src/canvas-target-registry";
import { PenGestureController } from "../src/pen-gesture-controller";

interface TestPointerEvent extends Event {
  pointerId: number;
  clientX: number;
  clientY: number;
  pressure: number;
  rawPointerType: string;
  rawButton: number;
  rawButtons: number;
}

describe("PenGestureController", () => {
  let registry: CanvasTargetRegistry;
  let card: HTMLElement;
  let viewport: CanvasViewport;
  let toggleTabletMode: ReturnType<typeof vi.fn<() => void>>;
  let requestEnvironmentSync: ReturnType<typeof vi.fn<() => void>>;
  let state: { tabletModeEnabled: boolean; panModeEnabled: boolean };
  let controller: PenGestureController;

  beforeEach(() => {
    document.body.replaceChildren();
    card = document.createElement("div");
    document.body.append(card);
    viewport = { tx: 0, ty: 0, markViewportChanged: vi.fn() };
    registry = new CanvasTargetRegistry();
    registry.replaceTargets([{ root: card, getViewport: () => viewport }]);
    toggleTabletMode = vi.fn<() => void>();
    requestEnvironmentSync = vi.fn<() => void>();
    state = { tabletModeEnabled: true, panModeEnabled: false };

    controller = new PenGestureController(window, {
      pointerPatch: {
        readRawPointerType: (event: TestPointerEvent) => event.rawPointerType,
        readRawButton: (event: TestPointerEvent) => event.rawButton,
        readRawButtons: (event: TestPointerEvent) => event.rawButtons,
      } as never,
      canvasTargets: registry,
      panController: new CanvasPanController(),
      getSettings: () => ({
        enableTabletModeOnStartup: false,
        enableBarrelDoubleClick: true,
        doubleClickIntervalMs: 300,
        enableBarrelPan: true,
        panThresholdPx: 5,
        showCanvasControls: true,
        debugLogging: false,
      }),
      getModeState: () => state,
      toggleTabletMode,
      requestEnvironmentSync,
      debug: vi.fn(),
    });
  });

  afterEach(() => controller.destroy());

  it("directly pans the Canvas during a temporary barrel drag", () => {
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2));
    window.dispatchEvent(pointerEvent("pointermove", 100, 10, -4, -1, 2));
    window.dispatchEvent(pointerEvent("pointerup", 120, 10, -4, 2, 0));

    expect(viewport.tx).toBe(10);
    expect(viewport.ty).toBe(-4);
    expect(viewport.markViewportChanged).toHaveBeenCalled();
  });

  it("directly pans with the pen tip in persistent Pan Mode", () => {
    state = { tabletModeEnabled: false, panModeEnabled: true };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 0, 1));
    window.dispatchEvent(pointerEvent("pointermove", 20, 8, 3, -1, 1));
    window.dispatchEvent(pointerEvent("pointerup", 30, 8, 3, 0, 0));

    expect(viewport.tx).toBe(8);
    expect(viewport.ty).toBe(3);
  });

  it("recognizes a jittery Native Pen barrel double-click", () => {
    state = { tabletModeEnabled: false, panModeEnabled: false };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2));
    window.dispatchEvent(pointerEvent("pointermove", 10, 6, 0, -1, 2));
    window.dispatchEvent(pointerEvent("pointerup", 20, 6, 0, 2, 0));

    card.dispatchEvent(pointerEvent("pointerdown", 150, 0, 0, 2, 2));
    window.dispatchEvent(pointerEvent("pointermove", 160, 6, 0, -1, 2));
    window.dispatchEvent(pointerEvent("pointerup", 170, 6, 0, 2, 0));

    expect(toggleTabletMode).toHaveBeenCalledOnce();
  });

  it("requests a lifecycle refresh when the Obsidian window regains focus", () => {
    window.dispatchEvent(new Event("focus"));
    expect(requestEnvironmentSync).toHaveBeenCalledOnce();
  });
});

function pointerEvent(
  type: string,
  timestamp: number,
  clientX: number,
  clientY: number,
  rawButton: number,
  rawButtons: number,
): TestPointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TestPointerEvent;
  const properties = {
    pointerId: 9,
    timeStamp: timestamp,
    clientX,
    clientY,
    pressure: 0.5,
    rawPointerType: "pen",
    rawButton,
    rawButtons,
  };
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(event, name, { configurable: true, value });
  }
  return event;
}
