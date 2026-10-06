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

export interface PenDiagnosticEntry {
  sequence: number;
  capturedAt: number;
  eventType: string;
  eventTimestamp: number;
  pointerId?: number;
  rawPointerType?: string;
  reportedPointerType?: string;
  rawButton?: number;
  rawButtons?: number;
  barrelButtonActive?: boolean;
  pressure?: number;
  isPrimary?: boolean;
  clientX: number;
  clientY: number;
  target: string;
  path: string[];
  targetInsideCanvas: boolean;
  activeCanvasSession: boolean;
  tabletModeEnabled: boolean;
  panModeEnabled: boolean;
  barrelGestureTracked: boolean;
  temporaryPanState: "inactive" | "armed" | "panning";
  contextMenuSuppressed?: boolean;
}

interface DirectPanGesture {
  pointerId: number;
  viewport: CanvasViewport;
  startTime: number;
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
  private static readonly diagnosticLimit = 500;
  private readonly machine: BarrelGestureMachine;
  private readonly activeCanvasPointers = new Set<number>();
  private readonly canvasPointerViewports = new Map<number, CanvasViewport>();
  private readonly barrelPressedPointers = new Set<number>();
  private persistentPan: DirectPanGesture | null = null;
  private temporaryPan: DirectPanGesture | null = null;
  private suppressContextMenuUntil = 0;
  private diagnosticSequence = 0;
  private readonly diagnostics: PenDiagnosticEntry[] = [];
  private readonly lastMoveDiagnosticSignature = new Map<number, string>();
  private readonly diagnosticCanvasPointers = new Set<number>();

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

  getDiagnostics(): readonly PenDiagnosticEntry[] {
    return [...this.diagnostics];
  }

  clearDiagnostics(): void {
    this.diagnostics.length = 0;
    this.lastMoveDiagnosticSignature.clear();
    this.diagnosticCanvasPointers.clear();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    if (insideCanvas && this.dependencies.getSettings().debugLogging) {
      this.diagnosticCanvasPointers.add(event.pointerId);
      this.recordPointerDiagnostic(event, true, true);
    }
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    const viewport = insideCanvas
      ? this.dependencies.canvasTargets.getViewportForEvent(event)
      : null;
    if (insideCanvas) {
      this.activeCanvasPointers.add(event.pointerId);
      if (viewport) {
        this.canvasPointerViewports.set(event.pointerId, viewport);
      }
    }

    const rawButton = this.dependencies.pointerPatch.readRawButton(event);
    this.updateBarrelButtonState(event, insideCanvas);

    if (insideCanvas && rawButton === 0 && this.dependencies.getModeState().panModeEnabled) {
      if (viewport) {
        this.persistentPan = {
          pointerId: event.pointerId,
          viewport,
          startTime: event.timeStamp,
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

    if (!this.barrelPressedPointers.has(event.pointerId)) {
      return;
    }

    if (!this.machine.isTracking(event.pointerId) && insideCanvas) {
      this.applyBarrelDecision(
        event,
        this.machine.pointerDown({
          ...pointerInput(event),
          insideCanvas: true,
          panAvailable: false,
        }),
      );
    }

    if (this.canStartTemporaryPan(event, viewport)) {
      this.beginTemporaryPan(event, viewport as CanvasViewport);
      // A tip contact made while the barrel is already held would otherwise look
      // like a left-button mouse down to Canvas and could start moving a card.
      if (rawButton === 0) {
        suppressEvent(event, true);
      }
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    const canvasSession =
      insideCanvas ||
      this.activeCanvasPointers.has(event.pointerId) ||
      this.diagnosticCanvasPointers.has(event.pointerId);
    if (canvasSession) {
      this.recordPointerDiagnostic(event, insideCanvas, canvasSession);
    }
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    const eventViewport = insideCanvas
      ? this.dependencies.canvasTargets.getViewportForEvent(event)
      : null;
    if (eventViewport && this.activeCanvasPointers.has(event.pointerId)) {
      this.canvasPointerViewports.set(event.pointerId, eventViewport);
    }
    const sessionViewport = canvasSession
      ? (eventViewport ?? this.canvasPointerViewports.get(event.pointerId) ?? null)
      : null;

    this.updateBarrelButtonState(event, canvasSession);

    if (this.persistentPan?.pointerId === event.pointerId) {
      this.movePersistentPan(event);
      return;
    }

    if (
      !this.temporaryPan &&
      this.barrelPressedPointers.has(event.pointerId) &&
      isPenContact(event, this.dependencies) &&
      this.canStartTemporaryPan(event, sessionViewport)
    ) {
      this.beginTemporaryPan(event, sessionViewport as CanvasViewport);
    }

    if (this.machine.isTracking(event.pointerId)) {
      this.machine.pointerMove(pointerInput(event));
    }

    if (this.temporaryPan?.pointerId === event.pointerId) {
      this.moveTemporaryPan(event);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    const canvasSession =
      insideCanvas ||
      this.activeCanvasPointers.has(event.pointerId) ||
      this.diagnosticCanvasPointers.has(event.pointerId);
    if (canvasSession) {
      this.recordPointerDiagnostic(event, insideCanvas, canvasSession);
    }
    this.diagnosticCanvasPointers.delete(event.pointerId);
    if (this.dependencies.pointerPatch.readRawPointerType(event) !== "pen") {
      return;
    }

    if (this.persistentPan?.pointerId === event.pointerId) {
      this.finishPersistentPan(event);
      this.releaseCanvasPointerAfterDispatch(event.pointerId);
      return;
    }

    if (this.machine.isTracking(event.pointerId)) {
      this.machine.pointerMove(pointerInput(event));
    }
    if (this.temporaryPan?.pointerId === event.pointerId) {
      this.finishTemporaryPan(event);
    }

    this.updateBarrelButtonState(event, canvasSession);
    this.releaseCanvasPointerAfterDispatch(event.pointerId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    if (insideCanvas || this.diagnosticCanvasPointers.has(event.pointerId)) {
      this.recordPointerDiagnostic(event, insideCanvas, true);
    }
    this.diagnosticCanvasPointers.delete(event.pointerId);
    this.cancelPointer(event.pointerId, "Pointer cancelled");
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    const insideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    if (insideCanvas || this.diagnosticCanvasPointers.has(event.pointerId)) {
      this.recordPointerDiagnostic(event, insideCanvas, true);
    }
    this.diagnosticCanvasPointers.delete(event.pointerId);
    this.cancelPointer(event.pointerId, "Pointer capture lost");
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    this.recordContextMenuDiagnostic(event);
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
    this.dependencies.panController.pan(
      gesture.viewport,
      deltaX,
      deltaY,
      this.dependencies.getSettings().naturalPanDirection,
    );
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
        this.dependencies.getSettings().naturalPanDirection,
      );
      this.dependencies.debug("Persistent pan ended", pointerSummary(event, this.dependencies));
    }
    suppressEvent(event, true);
    releasePointer(gesture.captureTarget, event.pointerId);
    this.persistentPan = null;
  }

  private applySuppression(event: Event, decision: BarrelGestureDecision): void {
    if (decision.suppressEvent) {
      suppressEvent(event, true);
    }
  }

  private cancelPointer(pointerId: number, reason: string): void {
    const hadPan =
      this.persistentPan?.pointerId === pointerId || this.temporaryPan?.pointerId === pointerId;
    if (this.persistentPan?.pointerId === pointerId) {
      releasePointer(this.persistentPan.captureTarget, pointerId);
      this.persistentPan = null;
    }
    if (this.temporaryPan?.pointerId === pointerId) {
      releasePointer(this.temporaryPan.captureTarget, pointerId);
      this.temporaryPan = null;
    }
    const decision = this.machine.cancel(pointerId);
    this.barrelPressedPointers.delete(pointerId);
    this.canvasPointerViewports.delete(pointerId);
    this.releaseCanvasPointerAfterDispatch(pointerId);
    if (hadPan || decision.panEnded) {
      this.dependencies.debug(reason);
    }
  }

  private releaseCanvasPointerAfterDispatch(pointerId: number): void {
    this.ownerWindow.setTimeout(() => {
      this.activeCanvasPointers.delete(pointerId);
      this.canvasPointerViewports.delete(pointerId);
    }, 0);
  }

  private resetGestures(): void {
    if (this.persistentPan) {
      releasePointer(this.persistentPan.captureTarget, this.persistentPan.pointerId);
    }
    this.machine.reset();
    this.persistentPan = null;
    if (this.temporaryPan) {
      releasePointer(this.temporaryPan.captureTarget, this.temporaryPan.pointerId);
    }
    this.temporaryPan = null;
    this.barrelPressedPointers.clear();
    this.canvasPointerViewports.clear();
    this.activeCanvasPointers.clear();
    this.diagnosticCanvasPointers.clear();
    this.suppressContextMenuUntil = 0;
  }

  private recordPointerDiagnostic(
    event: PointerEvent,
    targetInsideCanvas: boolean,
    activeCanvasSession: boolean,
  ): void {
    if (!this.dependencies.getSettings().debugLogging) {
      return;
    }

    const rawPointerType = this.dependencies.pointerPatch.readRawPointerType(event);
    const rawButton = this.dependencies.pointerPatch.readRawButton(event);
    const rawButtons = this.dependencies.pointerPatch.readRawButtons(event);
    const temporaryPanState = this.temporaryPan
      ? this.temporaryPan.started
        ? "panning"
        : "armed"
      : "inactive";
    const signature = [
      rawPointerType,
      rawButton,
      rawButtons,
      event.pressure > 0,
      targetInsideCanvas,
      activeCanvasSession,
      temporaryPanState,
      describeEventTarget(event.target, this.ownerWindow),
    ].join("|");

    if (
      event.type === "pointermove" &&
      this.lastMoveDiagnosticSignature.get(event.pointerId) === signature
    ) {
      return;
    }
    if (event.type === "pointermove") {
      this.lastMoveDiagnosticSignature.set(event.pointerId, signature);
    }

    const state = this.dependencies.getModeState();
    const entry: PenDiagnosticEntry = {
      sequence: ++this.diagnosticSequence,
      capturedAt: Date.now(),
      eventType: event.type,
      eventTimestamp: event.timeStamp,
      pointerId: event.pointerId,
      rawPointerType,
      reportedPointerType: event.pointerType,
      rawButton,
      rawButtons,
      barrelButtonActive: (rawButtons & 2) !== 0,
      pressure: event.pressure,
      isPrimary: event.isPrimary,
      clientX: event.clientX,
      clientY: event.clientY,
      target: describeEventTarget(event.target, this.ownerWindow),
      path: describeEventPath(event, this.ownerWindow),
      targetInsideCanvas,
      activeCanvasSession,
      tabletModeEnabled: state.tabletModeEnabled,
      panModeEnabled: state.panModeEnabled,
      barrelGestureTracked: this.machine.isTracking(event.pointerId),
      temporaryPanState,
    };
    this.appendDiagnostic(entry);
  }

  private recordContextMenuDiagnostic(event: MouseEvent): void {
    if (!this.dependencies.getSettings().debugLogging) {
      return;
    }
    const targetInsideCanvas = this.dependencies.canvasTargets.isEligibleCanvasEvent(event);
    const contextMenuSuppressed = Date.now() <= this.suppressContextMenuUntil;
    if (!targetInsideCanvas && !contextMenuSuppressed) {
      return;
    }
    const state = this.dependencies.getModeState();
    this.appendDiagnostic({
      sequence: ++this.diagnosticSequence,
      capturedAt: Date.now(),
      eventType: event.type,
      eventTimestamp: event.timeStamp,
      rawButton: event.button,
      rawButtons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      target: describeEventTarget(event.target, this.ownerWindow),
      path: describeEventPath(event, this.ownerWindow),
      targetInsideCanvas,
      activeCanvasSession: false,
      tabletModeEnabled: state.tabletModeEnabled,
      panModeEnabled: state.panModeEnabled,
      barrelGestureTracked: false,
      temporaryPanState: this.temporaryPan
        ? this.temporaryPan.started
          ? "panning"
          : "armed"
        : "inactive",
      contextMenuSuppressed,
    });
  }

  private appendDiagnostic(entry: PenDiagnosticEntry): void {
    this.diagnostics.push(entry);
    if (this.diagnostics.length > PenGestureController.diagnosticLimit) {
      this.diagnostics.splice(0, this.diagnostics.length - PenGestureController.diagnosticLimit);
    }
    this.dependencies.debug(`[DEBUG-ST-INPUT-v1] ${entry.eventType}`, entry);
  }

  private updateBarrelButtonState(event: PointerEvent, insideCanvas: boolean): void {
    const pressed = (this.dependencies.pointerPatch.readRawButtons(event) & 2) !== 0;
    const wasPressed = this.barrelPressedPointers.has(event.pointerId);
    if (pressed === wasPressed) {
      return;
    }

    if (pressed) {
      this.barrelPressedPointers.add(event.pointerId);
      const decision = this.machine.pointerDown({
        ...pointerInput(event),
        insideCanvas,
        panAvailable: false,
      });
      this.applyBarrelDecision(event, decision);
      if (decision.tracked) {
        this.dependencies.debug("Barrel button pressed", pointerSummary(event, this.dependencies));
      }
      return;
    }

    this.barrelPressedPointers.delete(event.pointerId);
    if (this.temporaryPan?.pointerId === event.pointerId) {
      this.finishTemporaryPan(event);
    }
    this.applyBarrelDecision(event, this.machine.pointerUp(pointerInput(event)));
    this.dependencies.debug("Barrel button released", pointerSummary(event, this.dependencies));
  }

  private applyBarrelDecision(event: Event, decision: BarrelGestureDecision): void {
    this.applySuppression(event, decision);
    if (decision.suppressContextMenu) {
      this.suppressContextMenuUntil = Date.now() + 1_000;
    }
    if (decision.toggleTabletMode) {
      this.dependencies.debug("Barrel double-click recognized");
      this.dependencies.toggleTabletMode();
    }
  }

  private canStartTemporaryPan(event: PointerEvent, viewport: CanvasViewport | null): boolean {
    const settings = this.dependencies.getSettings();
    return Boolean(
      !this.temporaryPan &&
      viewport &&
      this.dependencies.getModeState().tabletModeEnabled &&
      settings.enableBarrelPan &&
      this.barrelPressedPointers.has(event.pointerId) &&
      isPenContact(event, this.dependencies),
    );
  }

  private beginTemporaryPan(event: PointerEvent, viewport: CanvasViewport): void {
    this.temporaryPan = {
      pointerId: event.pointerId,
      viewport,
      startTime: event.timeStamp,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      started: false,
      captureTarget: pointerCaptureTarget(event.target),
    };
    this.dependencies.debug("Temporary barrel pan armed", pointerSummary(event, this.dependencies));
  }

  private moveTemporaryPan(event: PointerEvent): void {
    const gesture = this.temporaryPan;
    if (!gesture) {
      return;
    }

    if (!gesture.started) {
      const settings = this.dependencies.getSettings();
      const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      const clickTolerance = Math.max(12, settings.panThresholdPx * 3);
      if (event.timeStamp - gesture.startTime < 80 && distance < clickTolerance) {
        suppressEvent(event, true);
        return;
      }
      if (distance < settings.panThresholdPx) {
        suppressEvent(event, true);
        return;
      }
      gesture.started = true;
      // Once movement becomes a pan it must no longer be eligible as either
      // click of a barrel-button double-click.
      this.machine.cancel(event.pointerId);
      capturePointer(gesture.captureTarget, event.pointerId);
      this.suppressContextMenuUntil = Date.now() + 1_000;
      this.dependencies.debug(
        "Temporary barrel pan started",
        pointerSummary(event, this.dependencies),
      );
    }

    this.dependencies.panController.pan(
      gesture.viewport,
      event.clientX - gesture.lastX,
      event.clientY - gesture.lastY,
      this.dependencies.getSettings().naturalPanDirection,
    );
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    suppressEvent(event, true);
  }

  private finishTemporaryPan(event: PointerEvent): void {
    const gesture = this.temporaryPan;
    if (!gesture) {
      return;
    }

    if (gesture.started) {
      this.dependencies.panController.pan(
        gesture.viewport,
        event.clientX - gesture.lastX,
        event.clientY - gesture.lastY,
        this.dependencies.getSettings().naturalPanDirection,
      );
      this.suppressContextMenuUntil = Date.now() + 1_000;
      if (event.type === "pointerup") {
        // Let Canvas observe the release so a native gesture that began before
        // the barrel press cannot remain latched after temporary panning.
        if (event.cancelable) {
          event.preventDefault();
        }
      } else {
        suppressEvent(event, true);
      }
      this.dependencies.debug(
        "Temporary barrel pan ended",
        pointerSummary(event, this.dependencies),
      );
    }
    releasePointer(gesture.captureTarget, event.pointerId);
    this.temporaryPan = null;
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

function isPenContact(event: PointerEvent, dependencies: PenGestureDependencies): boolean {
  return (
    event.pressure > 0 ||
    (event.type === "pointerdown" && dependencies.pointerPatch.readRawButton(event) === 0)
  );
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

function describeEventPath(event: Event, ownerWindow: Window): string[] {
  return event
    .composedPath()
    .slice(0, 8)
    .map((target) => describeEventTarget(target, ownerWindow));
}

function describeEventTarget(target: EventTarget | null, ownerWindow: Window): string {
  if (!target) {
    return "null";
  }
  if (target === ownerWindow) {
    return "window";
  }
  if (target === ownerWindow.document) {
    return "document";
  }
  if ("tagName" in target && "classList" in target) {
    const element = target as Element;
    const id = element.id ? `#${element.id}` : "";
    const classes = [...element.classList]
      .slice(0, 6)
      .map((name) => `.${name}`)
      .join("");
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  }
  return target.constructor?.name ?? "EventTarget";
}
