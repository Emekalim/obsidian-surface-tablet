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
}

interface ActiveBarrelGesture extends BarrelPointerInput {
  secondClick: boolean;
  panAvailable: boolean;
  moved: boolean;
}

/** Pure state machine for barrel click, double-click, and drag classification. */
export class BarrelGestureMachine {
  private active: ActiveBarrelGesture | null = null;
  private firstClickAt: number | null = null;

  constructor(private readonly getConfig: () => BarrelGestureConfig) {}

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
      return { tracked: true };
    }

    const config = this.getConfig();
    const distance = Math.hypot(
      input.clientX - this.active.clientX,
      input.clientY - this.active.clientY,
    );

    if (distance < config.panThresholdPx) {
      return { tracked: true };
    }

    this.active.moved = true;
    this.firstClickAt = null;

    return {
      tracked: true,
      panStarted: this.active.panAvailable,
    };
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
      };
    }

    if (active.secondClick) {
      return {
        tracked: true,
        suppressEvent: true,
        suppressContextMenu: true,
        toggleTabletMode: true,
      };
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
}
