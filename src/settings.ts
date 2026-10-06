export interface SurfaceTabletSettings {
  enableTabletModeOnStartup: boolean;
  enableBarrelDoubleClick: boolean;
  doubleClickIntervalMs: number;
  enableBarrelPan: boolean;
  panThresholdPx: number;
  naturalPanDirection: boolean;
  showCanvasControls: boolean;
  debugLogging: boolean;
}

export const DEFAULT_SETTINGS: SurfaceTabletSettings = {
  enableTabletModeOnStartup: false,
  enableBarrelDoubleClick: true,
  doubleClickIntervalMs: 300,
  enableBarrelPan: true,
  panThresholdPx: 5,
  naturalPanDirection: true,
  showCanvasControls: true,
  debugLogging: false,
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export function sanitizeSettings(value: unknown): SurfaceTabletSettings {
  const input = isRecord(value) ? value : {};

  return {
    enableTabletModeOnStartup: booleanValue(
      input.enableTabletModeOnStartup,
      DEFAULT_SETTINGS.enableTabletModeOnStartup,
    ),
    enableBarrelDoubleClick: booleanValue(
      input.enableBarrelDoubleClick,
      DEFAULT_SETTINGS.enableBarrelDoubleClick,
    ),
    doubleClickIntervalMs: clamp(
      numberValue(input.doubleClickIntervalMs, DEFAULT_SETTINGS.doubleClickIntervalMs),
      200,
      600,
    ),
    enableBarrelPan: booleanValue(input.enableBarrelPan, DEFAULT_SETTINGS.enableBarrelPan),
    panThresholdPx: clamp(
      numberValue(input.panThresholdPx, DEFAULT_SETTINGS.panThresholdPx),
      2,
      20,
    ),
    naturalPanDirection: booleanValue(
      input.naturalPanDirection,
      DEFAULT_SETTINGS.naturalPanDirection,
    ),
    showCanvasControls: booleanValue(input.showCanvasControls, DEFAULT_SETTINGS.showCanvasControls),
    debugLogging: booleanValue(input.debugLogging, DEFAULT_SETTINGS.debugLogging),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
