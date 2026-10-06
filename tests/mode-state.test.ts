import { describe, expect, it, vi } from "vitest";
import { SurfaceTabletModeState } from "../src/mode-state";

describe("SurfaceTabletModeState", () => {
  it("starts with Pan Mode off", () => {
    const state = new SurfaceTabletModeState(true);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: true, panModeEnabled: false });
  });

  it("keeps Tablet and Pan modes independent", () => {
    const state = new SurfaceTabletModeState(false);
    state.setPanMode(true);
    state.setTabletMode(true);
    state.setTabletMode(false);
    expect(state.snapshot()).toEqual({ tabletModeEnabled: false, panModeEnabled: true });
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
