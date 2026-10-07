import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasPanController, type CanvasViewport } from "../src/canvas-pan-controller";
import { CanvasTargetRegistry } from "../src/canvas-target-registry";
import { PenGestureController, type ObsidianContextMenu } from "../src/pen-gesture-controller";

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
  let hideContextMenu: ReturnType<typeof vi.fn<() => void>>;
  let watchContextMenuForEvent: ReturnType<
    typeof vi.fn<(event: MouseEvent, callback: (menu: ObsidianContextMenu) => void) => () => void>
  >;
  let watchedContextMenus: WeakMap<MouseEvent, (menu: ObsidianContextMenu) => void>;
  let requestEnvironmentSync: ReturnType<typeof vi.fn<() => void>>;
  let state: { tabletModeEnabled: boolean; panModeEnabled: boolean };
  let naturalPanDirection: boolean;
  let doubleClickIntervalMs: number;
  let debugLogging: boolean;
  let controller: PenGestureController;

  beforeEach(() => {
    document.body.replaceChildren();
    card = document.createElement("div");
    document.body.append(card);
    viewport = { tx: 0, ty: 0, markViewportChanged: vi.fn() };
    registry = new CanvasTargetRegistry();
    registry.replaceTargets([{ root: card, getViewport: () => viewport }]);
    toggleTabletMode = vi.fn<() => void>();
    hideContextMenu = vi.fn<() => void>();
    watchedContextMenus = new WeakMap();
    watchContextMenuForEvent = vi.fn<
      (event: MouseEvent, callback: (menu: ObsidianContextMenu) => void) => () => void
    >((event, callback) => {
      watchedContextMenus.set(event, callback);
      return () => watchedContextMenus.delete(event);
    });
    requestEnvironmentSync = vi.fn<() => void>();
    state = { tabletModeEnabled: true, panModeEnabled: false };
    naturalPanDirection = true;
    doubleClickIntervalMs = 600;
    debugLogging = false;

    controller = new PenGestureController(window, {
      pointerPatch: {
        readRawPointerType: (event: TestPointerEvent) => event.rawPointerType,
        readRawButton: (event: TestPointerEvent) => event.rawButton,
        readRawButtons: (event: TestPointerEvent) => event.rawButtons,
        readRawIsPrimary: () => true,
      } as never,
      canvasTargets: registry,
      panController: new CanvasPanController(),
      getSettings: () => ({
        enableTabletModeOnStartup: false,
        enableBarrelDoubleClick: true,
        doubleClickIntervalMs,
        enableBarrelPan: true,
        panThresholdPx: 5,
        naturalPanDirection,
        showCanvasControls: true,
        debugLogging,
      }),
      getModeState: () => state,
      watchContextMenuForEvent,
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

    expect(viewport.tx).toBe(-10);
    expect(viewport.ty).toBe(4);
    expect(viewport.markViewportChanged).toHaveBeenCalled();
  });

  it("directly pans with the pen tip in persistent Pan Mode", () => {
    state = { tabletModeEnabled: false, panModeEnabled: true };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 0, 1));
    window.dispatchEvent(pointerEvent("pointermove", 20, 8, 3, -1, 1));
    window.dispatchEvent(pointerEvent("pointerup", 30, 8, 3, 0, 0));

    expect(viewport.tx).toBe(-8);
    expect(viewport.ty).toBe(-3);
  });

  it("keeps the previous direct pan direction when natural panning is disabled", () => {
    naturalPanDirection = false;
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

  it("recognizes the hardware-validated contact double-tap across pointer IDs", () => {
    state = { tabletModeEnabled: true, panModeEnabled: false };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2, 0.1, "pen", 47));
    window.dispatchEvent(pointerEvent("pointerup", 80, 0, 0, 2, 0, 0, "pen", 47));

    card.dispatchEvent(pointerEvent("pointerdown", 625, 1, 1, 2, 2, 0.2, "pen", 48));
    window.dispatchEvent(pointerEvent("pointerup", 690, 1, 1, 2, 0, 0, "pen", 48));

    expect(toggleTabletMode).toHaveBeenCalledOnce();
    const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    card.dispatchEvent(contextMenu);
    expect(contextMenu.defaultPrevented).toBe(true);
  });

  it("hides the exact context menu opened by the first barrel tap", () => {
    state = { tabletModeEnabled: false, panModeEnabled: false };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2, 0.1, "pen", 47));
    window.dispatchEvent(pointerEvent("pointerup", 80, 0, 0, 2, 0, 0, "pen", 47));
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    card.addEventListener(
      "contextmenu",
      () => {
        watchedContextMenus.get(contextMenuEvent)?.({
          hide: hideContextMenu,
          onHide: vi.fn(),
        });
      },
      { once: true },
    );
    card.dispatchEvent(contextMenuEvent);

    card.dispatchEvent(pointerEvent("pointerdown", 300, 1, 1, 2, 2, 0.2, "pen", 48));
    window.dispatchEvent(pointerEvent("pointerup", 370, 1, 1, 2, 0, 0, "pen", 48));

    expect(toggleTabletMode).toHaveBeenCalledOnce();
    expect(watchContextMenuForEvent).toHaveBeenCalledOnce();
    expect(hideContextMenu).toHaveBeenCalledOnce();
  });

  it("retains a Canvas menu shown asynchronously after the context-menu event", () => {
    vi.useFakeTimers();
    try {
      card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2, 0.1, "pen", 47));
      window.dispatchEvent(pointerEvent("pointerup", 80, 0, 0, 2, 0, 0, "pen", 47));
      const contextMenuEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      card.addEventListener(
        "contextmenu",
        () => {
          window.setTimeout(() => {
            watchedContextMenus.get(contextMenuEvent)?.({
              hide: hideContextMenu,
              onHide: vi.fn(),
            });
          }, 11);
        },
        { once: true },
      );
      card.dispatchEvent(contextMenuEvent);
      vi.advanceTimersByTime(11);

      card.dispatchEvent(pointerEvent("pointerdown", 300, 1, 1, 2, 2, 0.2, "pen", 48));
      window.dispatchEvent(pointerEvent("pointerup", 370, 1, 1, 2, 0, 0, "pen", 48));

      expect(toggleTabletMode).toHaveBeenCalledOnce();
      expect(hideContextMenu).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("recognizes barrel double-clicks from hover button-state transitions", () => {
    state = { tabletModeEnabled: false, panModeEnabled: false };
    card.dispatchEvent(pointerEvent("pointermove", 0, 0, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 20, 0, 0, -1, 0, 0));
    card.dispatchEvent(pointerEvent("pointermove", 150, 0, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 170, 0, 0, -1, 0, 0));

    expect(toggleTabletMode).toHaveBeenCalledOnce();
  });

  it("uses a barrel hold recognized before contact for temporary panning", () => {
    card.dispatchEvent(pointerEvent("pointermove", 0, 0, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointerdown", 20, 0, 0, 0, 2, 0.5));
    window.dispatchEvent(pointerEvent("pointermove", 120, 10, -4, -1, 2, 0.5));
    window.dispatchEvent(pointerEvent("pointerup", 140, 10, -4, 0, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 160, 10, -4, -1, 0, 0));

    expect(viewport.tx).toBe(-10);
    expect(viewport.ty).toBe(4);
    expect(viewport.markViewportChanged).toHaveBeenCalled();
  });

  it("uses contact barrel-drag panning in Native Pen mode", () => {
    state = { tabletModeEnabled: false, panModeEnabled: false };
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2, 0.1));
    window.dispatchEvent(pointerEvent("pointermove", 100, -12, 6, -1, 2, 0.2));
    window.dispatchEvent(pointerEvent("pointerup", 120, -12, 6, 2, 0, 0));

    expect(viewport.tx).toBe(12);
    expect(viewport.ty).toBe(-6);

    const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    card.dispatchEvent(contextMenu);
    expect(contextMenu.defaultPrevented).toBe(true);
  });

  it("starts temporary panning when the barrel button is pressed during contact", () => {
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 0, 1, 0.5));
    card.dispatchEvent(pointerEvent("pointermove", 20, 0, 0, -1, 3, 0.5));
    window.dispatchEvent(pointerEvent("pointermove", 120, 12, 5, -1, 3, 0.5));
    window.dispatchEvent(pointerEvent("pointerup", 140, 12, 5, 0, 0, 0));

    expect(viewport.tx).toBe(-12);
    expect(viewport.ty).toBe(-5);
  });

  it("does not count a completed barrel pan as a double-click", () => {
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2));
    window.dispatchEvent(pointerEvent("pointermove", 100, 10, 0, -1, 2));
    window.dispatchEvent(pointerEvent("pointerup", 120, 10, 0, 2, 0));

    card.dispatchEvent(pointerEvent("pointermove", 200, 10, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 220, 10, 0, -1, 0, 0));

    expect(toggleTabletMode).not.toHaveBeenCalled();
  });

  it("does not reuse a hovered Canvas viewport for contact outside Canvas", () => {
    const outside = document.createElement("div");
    document.body.append(outside);
    card.dispatchEvent(pointerEvent("pointermove", 0, 0, 0, -1, 0, 0));
    outside.dispatchEvent(pointerEvent("pointermove", 20, 0, 0, -1, 2, 0.5));
    outside.dispatchEvent(pointerEvent("pointermove", 120, 12, 5, -1, 2, 0.5));
    outside.dispatchEvent(pointerEvent("pointerup", 140, 12, 5, 2, 0, 0));

    expect(viewport.tx).toBe(0);
    expect(viewport.ty).toBe(0);
  });

  it("captures changed raw hover button states when diagnostics are enabled", () => {
    debugLogging = true;
    card.dispatchEvent(pointerEvent("pointermove", 0, 0, 0, -1, 0, 0));
    card.dispatchEvent(pointerEvent("pointermove", 10, 1, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 20, 2, 0, -1, 2, 0));
    card.dispatchEvent(pointerEvent("pointermove", 30, 2, 0, -1, 0, 0));

    expect(controller.getDiagnostics().map((entry) => entry.rawButtons)).toEqual([0, 2, 0]);
    expect(controller.getDiagnostics()[1]).toMatchObject({
      eventType: "pointermove",
      rawPointerType: "pen",
      barrelButtonActive: true,
      targetInsideCanvas: true,
    });

    controller.clearDiagnostics();
    expect(controller.getDiagnostics()).toEqual([]);
  });

  it("does not retain diagnostics while debug logging is disabled", () => {
    card.dispatchEvent(pointerEvent("pointermove", 0, 0, 0, -1, 2, 0));
    expect(controller.getDiagnostics()).toEqual([]);
  });

  it("captures non-pen Canvas events for comparison without handling them", () => {
    debugLogging = true;
    card.dispatchEvent(pointerEvent("pointerdown", 0, 0, 0, 2, 2, 0, "mouse"));

    expect(controller.getDiagnostics()).toHaveLength(1);
    expect(controller.getDiagnostics()[0]).toMatchObject({
      eventType: "pointerdown",
      rawPointerType: "mouse",
      rawButton: 2,
      rawButtons: 2,
    });
    expect(viewport.markViewportChanged).not.toHaveBeenCalled();
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
  pressure = 0.5,
  rawPointerType = "pen",
  pointerId = 9,
): TestPointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TestPointerEvent;
  const properties = {
    pointerId,
    timeStamp: timestamp,
    clientX,
    clientY,
    pressure,
    rawPointerType,
    rawButton,
    rawButtons,
  };
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(event, name, { configurable: true, value });
  }
  return event;
}
