export interface BarrelGestureConfig {
  doubleClickEnabled: boolean;
  doubleClickIntervalMs: number;
  panThresholdPx: number;
}

export interface BarrelPointerInput {
  pointerId: number;
  timestamp: number;
  clientX: number;
  clientY: number;
}

export interface BarrelDownInput extends BarrelPointerInput {
  insideCanvas: boolean;
  panAvailable: boolean;
}

export interface BarrelGestureDecision {
  tracked?: boolean;
  suppressEvent?: boolean;
  panStarted?: boolean;
  panEnded?: boolean;
  suppressContextMenu?: boolean;
  toggleTabletMode?: boolean;
  panDeltaX?: number;
  panDeltaY?: number;
}

interface ActiveBarrelGesture extends BarrelPointerInput {
  secondClick: boolean;
  panAvailable: boolean;
  moved: boolean;
  lastX: number;
  lastY: number;
}

/** Pure state machine for barrel click, double-click, and drag classification. */
export class BarrelGestureMachine {
  private active: ActiveBarrelGesture | null = null;
  private firstClickAt: number | null = null;

  constructor(private readonly getConfig: () => BarrelGestureConfig) {}

  isTracking(pointerId: number): boolean {
    return this.active?.pointerId === pointerId;
  }

  pointerDown(input: BarrelDownInput): BarrelGestureDecision {
    const config = this.getConfig();
    this.expireFirstClick(input.timestamp, config.doubleClickIntervalMs);

    const secondClick =
      config.doubleClickEnabled &&
      this.firstClickAt !== null &&
      input.timestamp - this.firstClickAt <= config.doubleClickIntervalMs;

    if (!input.insideCanvas && !secondClick) {
      return {};
    }

    this.active = {
      pointerId: input.pointerId,
      timestamp: input.timestamp,
      clientX: input.clientX,
      clientY: input.clientY,
      secondClick,
      panAvailable: input.panAvailable && input.insideCanvas,
      moved: false,
      lastX: input.clientX,
      lastY: input.clientY,
    };

    if (secondClick) {
      this.firstClickAt = null;
    }

    return { tracked: true, suppressEvent: secondClick };
  }

  pointerMove(input: BarrelPointerInput): BarrelGestureDecision {
    if (!this.active || this.active.pointerId !== input.pointerId) {
      return {};
    }

    if (this.active.moved) {
      const decision = this.panDelta(input);
      this.updateLastPosition(input);
      return decision;
    }

    const config = this.getConfig();
    const distance = Math.hypot(
      input.clientX - this.active.clientX,
      input.clientY - this.active.clientY,
    );
    const clickTolerance = Math.max(12, config.panThresholdPx * 3);

    if (
      this.active.panAvailable &&
      input.timestamp - this.active.timestamp < 80 &&
      distance < clickTolerance
    ) {
      return { tracked: true };
    }

    const movementThreshold = this.active.panAvailable ? config.panThresholdPx : clickTolerance;
    if (distance < movementThreshold) {
      return { tracked: true };
    }

    this.active.moved = true;
    this.firstClickAt = null;

    const decision = {
      tracked: true,
      panStarted: this.active.panAvailable,
      ...(this.active.panAvailable
        ? {
            panDeltaX: input.clientX - this.active.clientX,
            panDeltaY: input.clientY - this.active.clientY,
          }
        : {}),
    };
    this.updateLastPosition(input);
    return decision;
  }

  pointerUp(input: BarrelPointerInput): BarrelGestureDecision {
    if (!this.active || this.active.pointerId !== input.pointerId) {
      return {};
    }

    const active = this.active;
    this.active = null;

    if (active.moved) {
      return {
        tracked: true,
        panEnded: active.panAvailable,
        suppressContextMenu: active.panAvailable,
        ...(active.panAvailable
          ? {
              panDeltaX: input.clientX - active.lastX,
              panDeltaY: input.clientY - active.lastY,
            }
          : {}),
      };
    }

    if (active.secondClick) {
      if (distanceFromStart(active, input) >= clickTolerance(this.getConfig())) {
        return { tracked: true };
      }
      return {
        tracked: true,
        suppressEvent: true,
        suppressContextMenu: true,
        toggleTabletMode: true,
      };
    }

    if (distanceFromStart(active, input) >= clickTolerance(this.getConfig())) {
      this.firstClickAt = null;
      return { tracked: true };
    }

    if (this.getConfig().doubleClickEnabled) {
      this.firstClickAt = input.timestamp;
    }

    return { tracked: true };
  }

  cancel(pointerId?: number): BarrelGestureDecision {
    if (!this.active || (pointerId !== undefined && this.active.pointerId !== pointerId)) {
      return {};
    }

    const panEnded = this.active.moved && this.active.panAvailable;
    this.active = null;
    return { tracked: true, panEnded };
  }

  reset(): void {
    this.active = null;
    this.firstClickAt = null;
  }

  private expireFirstClick(timestamp: number, interval: number): void {
    if (this.firstClickAt !== null && timestamp - this.firstClickAt > interval) {
      this.firstClickAt = null;
    }
  }

  private panDelta(input: BarrelPointerInput): BarrelGestureDecision {
    if (!this.active?.panAvailable) {
      return { tracked: true };
    }
    return {
      tracked: true,
      panDeltaX: input.clientX - this.active.lastX,
      panDeltaY: input.clientY - this.active.lastY,
    };
  }

  private updateLastPosition(input: BarrelPointerInput): void {
    if (!this.active) {
      return;
    }
    this.active.lastX = input.clientX;
    this.active.lastY = input.clientY;
  }
}

function distanceFromStart(active: ActiveBarrelGesture, input: BarrelPointerInput): number {
  return Math.hypot(input.clientX - active.clientX, input.clientY - active.clientY);
}

function clickTolerance(config: BarrelGestureConfig): number {
  return Math.max(12, config.panThresholdPx * 3);
}
