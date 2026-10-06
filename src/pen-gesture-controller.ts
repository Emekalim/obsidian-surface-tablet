import {
  BarrelGestureMachine,
  type BarrelGestureDecision,
  type BarrelPointerInput,
} from "./barrel-gesture-machine";
import type { CanvasTargetRegistry } from "./canvas-target-registry";
import type { SurfaceTabletModeSnapshot } from "./mode-state";
import type { WindowPointerPatch } from "./pointer-type-override";
import type { SurfaceTabletSettings } from "./settings";

export interface PenGestureDependencies {
  pointerPatch: WindowPointerPatch;
  canvasTargets: CanvasTargetRegistry;
  getSettings: () => Readonly<SurfaceTabletSettings>;
  getModeState: () => Readonly<SurfaceTabletModeSnapshot>;
  toggleTabletMode: () => void;
  debug: (message: string, details?: unknown) => void;
}

/** Handles raw barrel gestures without changing native single-click propagation. */
export class PenGestureController {
  private readonly machine: BarrelGestureMachine;
  private suppressContextMenuUntil = 0;

  constructor(
    private readonly ownerWindow: Window,
    private readonly dependencies: PenGestureDependencies,
  ) {
    this.machine = new BarrelGestureMachine(() => ({
      doubleClickEnabled: this.dependencies.getSettings().enableBarrelDoubleClick,
      doubleClickIntervalMs: this.dependencies.getSettings().doubleClickIntervalMs,
      panThresholdPx: this.dependencies.getSettings().panThresholdPx,
    }));

    ownerWindow.addEventListener("pointerdown", this.onPointerDown, true);
    ownerWindow.addEventListener("pointermove", this.onPointerMove, true);
    ownerWindow.addEventListener("pointerup", this.onPointerUp, true);
    ownerWindow.addEventListener("pointercancel", this.onPointerCancel, true);
    ownerWindow.addEventListener("lostpointercapture", this.onLostPointerCapture, true);
    ownerWindow.addEventListener("contextmenu", this.onContextMenu, true);
  }

  destroy(): void {
    this.machine.reset();
    this.ownerWindow.removeEventListener("pointerdown", this.onPointerDown, true);
    this.ownerWindow.removeEventListener("pointermove", this.onPointerMove, true);
    this.ownerWindow.removeEventListener("pointerup", this.onPointerUp, true);
    this.ownerWindow.removeEventListener("pointercancel", this.onPointerCancel, true);
    this.ownerWindow.removeEventListener("lostpointercapture", this.onLostPointerCapture, true);
    this.ownerWindow.removeEventListener("contextmenu", this.onContextMenu, true);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.isBarrelEvent(event)) {
      return;
    }

    const state = this.dependencies.getModeState();
    const settings = this.dependencies.getSettings();
    const decision = this.machine.pointerDown({
      ...pointerInput(event),
      insideCanvas: this.dependencies.canvasTargets.isEligibleCanvasEvent(event),
      panAvailable: state.tabletModeEnabled && settings.enableBarrelPan,
    });

    this.applySuppression(event, decision);
    if (decision.tracked) {
      this.dependencies.debug("Barrel pointer down", pointerSummary(event, this.dependencies));
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    const decision = this.machine.pointerMove(pointerInput(event));
    if (decision.panStarted) {
      this.suppressContextMenuUntil = Date.now() + 1_000;
      this.dependencies.debug("Barrel pan started", pointerSummary(event, this.dependencies));
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    const decision = this.machine.pointerUp(pointerInput(event));
    this.applySuppression(event, decision);

    if (decision.suppressContextMenu) {
      this.suppressContextMenuUntil = Date.now() + 1_000;
    }
    if (decision.toggleTabletMode) {
      this.dependencies.debug("Barrel double-click recognized");
      this.dependencies.toggleTabletMode();
    } else if (decision.panEnded) {
      this.dependencies.debug("Barrel pan ended", pointerSummary(event, this.dependencies));
    }
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    const decision = this.machine.cancel(event.pointerId);
    if (decision.panEnded) {
      this.dependencies.debug("Barrel pan cancelled");
    }
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    const decision = this.machine.cancel(event.pointerId);
    if (decision.panEnded) {
      this.dependencies.debug("Barrel pan stopped after lost pointer capture");
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (Date.now() > this.suppressContextMenuUntil) {
      return;
    }
    this.suppressContextMenuUntil = 0;
    suppressEvent(event);
    this.dependencies.debug("Suppressed context menu after pan or double-click");
  };

  private isBarrelEvent(event: PointerEvent): boolean {
    return (
      this.dependencies.pointerPatch.readRawPointerType(event) === "pen" &&
      this.dependencies.pointerPatch.readRawButton(event) === 2
    );
  }

  private applySuppression(event: Event, decision: BarrelGestureDecision): void {
    if (decision.suppressEvent) {
      suppressEvent(event);
    }
  }
}

function pointerInput(event: PointerEvent): BarrelPointerInput {
  return {
    pointerId: event.pointerId,
    timestamp: event.timeStamp,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

function suppressEvent(event: Event): void {
  if (event.cancelable) {
    event.preventDefault();
  }
  event.stopPropagation();
}

function pointerSummary(event: PointerEvent, dependencies: PenGestureDependencies): unknown {
  return {
    pointerType: dependencies.pointerPatch.readRawPointerType(event),
    pointerId: event.pointerId,
    button: dependencies.pointerPatch.readRawButton(event),
    buttons: dependencies.pointerPatch.readRawButtons(event),
    clientX: event.clientX,
    clientY: event.clientY,
    pressure: event.pressure,
    target: event.target,
  };
}
