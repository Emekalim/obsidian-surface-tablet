import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings";

describe("sanitizeSettings", () => {
  it("uses defaults for missing or invalid data", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ enableBarrelPan: "yes", doubleClickIntervalMs: Number.NaN })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("clamps configurable numeric ranges", () => {
    const result = sanitizeSettings({ doubleClickIntervalMs: 999, panThresholdPx: 0 });
    expect(result.doubleClickIntervalMs).toBe(600);
    expect(result.panThresholdPx).toBe(2);
  });

  it("preserves valid booleans and numbers", () => {
    const result = sanitizeSettings({
      enableTabletModeOnStartup: true,
      enableBarrelDoubleClick: false,
      doubleClickIntervalMs: 350,
      enableBarrelPan: false,
      panThresholdPx: 8,
      naturalPanDirection: false,
      showCanvasControls: false,
      debugLogging: true,
    });
    expect(result).toEqual({
      enableTabletModeOnStartup: true,
      enableBarrelDoubleClick: false,
      doubleClickIntervalMs: 350,
      enableBarrelPan: false,
      panThresholdPx: 8,
      naturalPanDirection: false,
      showCanvasControls: false,
      debugLogging: true,
    });
  });
});
