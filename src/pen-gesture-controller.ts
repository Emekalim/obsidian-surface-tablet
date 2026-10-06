import {
  BarrelGestureMachine,
  type BarrelGestureDecision,
  type BarrelPointerInput,
} from "./barrel-gesture-machine";
import type { CanvasPanController, CanvasViewport } from "./canvas-pan-controller";
import type { CanvasTargetRegistry } from "./canvas-target-registry";
import type { SurfaceTabletModeSnapshot } from "./mode-state";
import type { WindowPointerPatch } from "./pointer-type-override";
import type { SurfaceTabletSettings } from "./settings";

export interface PenGestureDependencies {
  pointerPatch: WindowPointerPatch;
  canvasTargets: CanvasTargetRegistry;
  panController: CanvasPanController;
  getSettings: () => Readonly<SurfaceTabletSettings>;
  getModeState: () => Readonly<SurfaceTabletModeSnapshot>;
  toggleTabletMode: () => void;
  requestEnvironmentSync: () => void;
  debug: (message: string, details?: unknown) => void;
}

interface DirectPanGesture {
  pointerId: number;
  viewport: CanvasViewport;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  started: boolean;
  captureTarget: PointerCaptureTarget | null;
}

interface PointerCaptureTarget extends EventTarget {
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
}

/** Tracks Canvas pointer sessions and implements barrel and persistent panning. */
export class PenGestureController {
  private readonly machine: BarrelGestureMachine;
  private readonly activeCanvasPointers = new Set<number>();
  private persistentPan: DirectPanGesture | null = null;
  private barrelPanViewport: CanvasViewport | null = null;
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
    ownerWindow.addEventListener("blur", this.onWindowBlur, true);
    ownerWindow.addEventListener("focus", this.onWindowFocus, true);
    ownerWindow.document.addEventListener("visibilitychange", this.onVisibilityChange, true);
  }

  destroy(): void {
    this.resetGestures();
    this.ownerWindow.removeEventListener("pointerdown", this.onPointerDown, true);
    this.ownerWindow.removeEventListener("pointermove", this.onPointerMove, true);
    this.ownerWindow.removeEventListener("pointerup", this.onPointerUp, true);
    this.ownerWindow.removeEventListener("pointercancel", this.onPointerCancel, true);
    this.ownerWindow.removeEventListener("lostpointercapture", this.onLostPointerCapture, true);
    this.ownerWindow.removeEventListener("contextmenu", this.onContextMenu, true);
    this.ownerWindow.removeEventListener("blur", this.onWindowBlur, true);
    this.ownerWindow.removeEventListener("focus", this.onWindowFocus, true);
    this.ownerWindow.document.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange,
      true,
    );
  }

  isActiveCanvasPointer(event: PointerEvent): boolean {
    return this.activeCanvasPointers.has(event.pointerId);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    if (insideCanvas) {
      this.activeCanvasPointers.add(event.pointerId);
    }

    const rawButton = this.dependencies.pointerPatch.readRawButton(event);
    if (insideCanvas && rawButton === 0 && this.dependencies.getModeState().panModeEnabled) {
      const viewport = this.dependencies.canvasTargets.getViewportForEvent(event);
      if (viewport) {
        this.persistentPan = {
          pointerId: event.pointerId,
          viewport,
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          started: false,
          captureTarget: pointerCaptureTarget(event.target),
        };
        capturePointer(this.persistentPan.captureTarget, event.pointerId);
        suppressEvent(event, true);
        this.dependencies.debug(
          "Persistent pan pointer down",
          pointerSummary(event, this.dependencies),
        );
      }
      return;
    }

    if (rawButton !== 2) {
      return;
    }

    const state = this.dependencies.getModeState();
    const settings = this.dependencies.getSettings();
    const viewport = insideCanvas
      ? this.dependencies.canvasTargets.getViewportForEvent(event)
      : null;
    const decision = this.machine.pointerDown({
      ...pointerInput(event),
      insideCanvas,
      panAvailable: Boolean(state.tabletModeEnabled && settings.enableBarrelPan && viewport),
    });

    if (decision.tracked) {
      this.barrelPanViewport = viewport;
      this.dependencies.debug("Barrel pointer down", pointerSummary(event, this.dependencies));
    }
    this.applySuppression(event, decision);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    if (this.persistentPan?.pointerId === event.pointerId) {
      this.movePersistentPan(event);
      return;
    }

    const decision = this.machine.pointerMove(pointerInput(event));
    const moved = this.applyBarrelPan(decision);
    if (decision.panStarted) {
      this.suppressContextMenuUntil = Date.now() + 1_000;
      this.dependencies.debug(
        "Temporary barrel pan started",
        pointerSummary(event, this.dependencies),
      );
    }
    if (moved) {
      suppressEvent(event, true);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    if (this.persistentPan?.pointerId === event.pointerId) {
      this.finishPersistentPan(event);
      this.releaseCanvasPointerAfterDispatch(event.pointerId);
      return;
    }

    const decision = this.machine.pointerUp(pointerInput(event));
    this.applyBarrelPan(decision);
    this.applySuppression(event, decision);

    if (decision.panEnded) {
      if (event.cancelable) {
        event.preventDefault();
      }
      this.dependencies.debug(
        "Temporary barrel pan ended",
        pointerSummary(event, this.dependencies),
      );
    }
    this.barrelPanViewport = null;

    if (decision.suppressContextMenu) {
      this.suppressContextMenuUntil = Date.now() + 1_000;
    }
    if (decision.toggleTabletMode) {
      this.dependencies.debug("Barrel double-click recognized");
      this.dependencies.toggleTabletMode();
    }
    this.releaseCanvasPointerAfterDispatch(event.pointerId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.cancelPointer(event.pointerId, "Pointer cancelled");
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    this.cancelPointer(event.pointerId, "Pointer capture lost");
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (Date.now() > this.suppressContextMenuUntil) {
      return;
    }
    this.suppressContextMenuUntil = 0;
    suppressEvent(event, true);
    this.dependencies.debug("Suppressed context menu after pan or double-click");
  };

  private readonly onWindowBlur = (): void => {
    this.resetGestures();
    this.dependencies.debug("Reset pointer state after window blur");
  };

  private readonly onWindowFocus = (): void => {
    this.dependencies.requestEnvironmentSync();
  };

  private readonly onVisibilityChange = (): void => {
    if (this.ownerWindow.document.visibilityState === "visible") {
      this.dependencies.requestEnvironmentSync();
    } else {
      this.resetGestures();
    }
  };

  private movePersistentPan(event: PointerEvent): void {
    const gesture = this.persistentPan;
    if (!gesture) {
      return;
    }

    if (!gesture.started) {
      const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      if (distance < this.dependencies.getSettings().panThresholdPx) {
        suppressEvent(event, true);
        return;
      }
      gesture.started = true;
      this.dependencies.debug("Persistent pan started", pointerSummary(event, this.dependencies));
    }

    const deltaX = event.clientX - gesture.lastX;
    const deltaY = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    this.dependencies.panController.pan(gesture.viewport, deltaX, deltaY);
    suppressEvent(event, true);
  }

  private finishPersistentPan(event: PointerEvent): void {
    const gesture = this.persistentPan;
    if (!gesture) {
      return;
    }

    if (gesture.started) {
      this.dependencies.panController.pan(
        gesture.viewport,
        event.clientX - gesture.lastX,
        event.clientY - gesture.lastY,
      );
      this.dependencies.debug("Persistent pan ended", pointerSummary(event, this.dependencies));
    }
    suppressEvent(event, true);
    releasePointer(gesture.captureTarget, event.pointerId);
    this.persistentPan = null;
  }

  private applyBarrelPan(decision: BarrelGestureDecision): boolean {
    if (decision.panDeltaX === undefined || decision.panDeltaY === undefined) {
      return false;
    }
    return this.dependencies.panController.pan(
      this.barrelPanViewport,
      decision.panDeltaX,
      decision.panDeltaY,
    );
  }

  private applySuppression(event: Event, decision: BarrelGestureDecision): void {
    if (decision.suppressEvent) {
      suppressEvent(event, true);
    }
  }

  private cancelPointer(pointerId: number, reason: string): void {
    if (this.persistentPan?.pointerId === pointerId) {
      releasePointer(this.persistentPan.captureTarget, pointerId);
      this.persistentPan = null;
    }
    const decision = this.machine.cancel(pointerId);
    this.barrelPanViewport = null;
    this.releaseCanvasPointerAfterDispatch(pointerId);
    if (decision.panEnded) {
      this.dependencies.debug(reason);
    }
  }

  private releaseCanvasPointerAfterDispatch(pointerId: number): void {
    this.ownerWindow.setTimeout(() => this.activeCanvasPointers.delete(pointerId), 0);
  }

  private resetGestures(): void {
    if (this.persistentPan) {
      releasePointer(this.persistentPan.captureTarget, this.persistentPan.pointerId);
    }
    this.machine.reset();
    this.persistentPan = null;
    this.barrelPanViewport = null;
    this.activeCanvasPointers.clear();
    this.suppressContextMenuUntil = 0;
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

function suppressEvent(event: Event, immediate = false): void {
  if (event.cancelable) {
    event.preventDefault();
  }
  if (immediate) {
    event.stopImmediatePropagation();
  } else {
    event.stopPropagation();
  }
}

function pointerCaptureTarget(value: EventTarget | null): PointerCaptureTarget | null {
  if (
    value &&
    "setPointerCapture" in value &&
    typeof value.setPointerCapture === "function" &&
    "releasePointerCapture" in value &&
    typeof value.releasePointerCapture === "function"
  ) {
    return value as PointerCaptureTarget;
  }
  return null;
}

function capturePointer(target: PointerCaptureTarget | null, pointerId: number): void {
  try {
    target?.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is opportunistic; window listeners still complete the gesture.
  }
}

function releasePointer(target: PointerCaptureTarget | null, pointerId: number): void {
  try {
    if (!target?.hasPointerCapture || target.hasPointerCapture(pointerId)) {
      target?.releasePointerCapture(pointerId);
    }
  } catch {
    // The browser may already have released capture during cancellation or blur.
  }
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
