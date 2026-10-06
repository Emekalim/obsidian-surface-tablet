import { describe, expect, it, vi } from "vitest";
import { SurfaceTabletModeState } from "../src/mode-state";

describe("SurfaceTabletModeState", () => {
  it("starts with Pan Mode off", () => {
    const state = new SurfaceTabletModeState(true);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: true, panModeEnabled: false });
  });

  it("does not enable the other mode when the current mode is disabled", () => {
    const state = new SurfaceTabletModeState(false);
    state.setPanMode(true);
    state.setPanMode(false);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: false, panModeEnabled: false });
  });

  it("never leaves persistent Pan Mode and Mouse Emulation enabled together", () => {
    const state = new SurfaceTabletModeState(true);
    state.setPanMode(true);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: false, panModeEnabled: true });

    state.setTabletMode(true);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: true, panModeEnabled: false });
  });

  it("notifies subscribers only on changes", () => {
    const state = new SurfaceTabletModeState(false);
    const listener = vi.fn();
    state.subscribe(listener);
    state.setTabletMode(false);
    state.setTabletMode(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
