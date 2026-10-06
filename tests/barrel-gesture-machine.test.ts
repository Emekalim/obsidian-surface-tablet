import { describe, expect, it } from "vitest";
import { BarrelGestureMachine } from "../src/barrel-gesture-machine";

const config = {
  doubleClickEnabled: true,
  doubleClickIntervalMs: 300,
  panThresholdPx: 5,
};

const point = (timestamp: number, x = 10, y = 10) => ({
  pointerId: 7,
  timestamp,
  clientX: x,
  clientY: y,
});

describe("BarrelGestureMachine", () => {
  it("allows an ordinary first barrel click", () => {
    const machine = new BarrelGestureMachine(() => config);
    expect(machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true })).toEqual({
      tracked: true,
      suppressEvent: false,
    });
    expect(machine.pointerUp(point(120))).toEqual({ tracked: true });
  });

  it("recognizes an armed second click outside Canvas", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });
    machine.pointerUp(point(120));

    expect(
      machine.pointerDown({ ...point(250), insideCanvas: false, panAvailable: false }),
    ).toMatchObject({ tracked: true, suppressEvent: true });
    expect(machine.pointerUp(point(270))).toMatchObject({
      suppressEvent: true,
      suppressContextMenu: true,
      toggleTabletMode: true,
    });
  });

  it("does not accept a late second click outside Canvas", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });
    machine.pointerUp(point(120));

    expect(
      machine.pointerDown({ ...point(421), insideCanvas: false, panAvailable: false }),
    ).toEqual({});
  });

  it("classifies movement at the threshold as a pan", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });
    expect(machine.pointerMove(point(190, 13, 14))).toMatchObject({ panStarted: true });
    expect(machine.pointerUp(point(210, 13, 14))).toMatchObject({
      panEnded: true,
      suppressContextMenu: true,
    });
  });

  it("does not claim panning when pan is unavailable", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: false });
    expect(machine.pointerMove(point(110, 30, 30))).toMatchObject({ panStarted: false });
    expect(machine.pointerUp(point(130, 30, 30))).toMatchObject({
      panEnded: false,
      suppressContextMenu: false,
    });
  });

  it("emits pan deltas after a barrel drag crosses the threshold", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });

    expect(machine.pointerMove(point(190, 20, 15))).toMatchObject({
      panStarted: true,
      panDeltaX: 10,
      panDeltaY: 5,
    });
    expect(machine.pointerMove(point(200, 23, 19))).toMatchObject({
      panDeltaX: 3,
      panDeltaY: 4,
    });
  });

  it("tolerates small pen jitter while double-clicking in Native Pen Mode", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: false });
    machine.pointerMove(point(110, 16, 10));
    machine.pointerUp(point(120, 16, 10));

    machine.pointerDown({ ...point(220), insideCanvas: true, panAvailable: false });
    machine.pointerMove(point(230, 16, 10));
    expect(machine.pointerUp(point(240, 16, 10))).toMatchObject({
      toggleTabletMode: true,
    });
  });

  it("does not misclassify quick double-click jitter as temporary panning", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });
    machine.pointerMove(point(110, 16, 10));
    machine.pointerUp(point(120, 16, 10));

    machine.pointerDown({ ...point(220), insideCanvas: true, panAvailable: true });
    machine.pointerMove(point(230, 16, 10));
    expect(machine.pointerUp(point(240, 16, 10))).toMatchObject({
      toggleTabletMode: true,
    });
  });

  it("clears active panning on cancellation", () => {
    const machine = new BarrelGestureMachine(() => config);
    machine.pointerDown({ ...point(100), insideCanvas: true, panAvailable: true });
    machine.pointerMove(point(190, 20, 20));
    expect(machine.cancel(7)).toMatchObject({ panEnded: true });
    expect(machine.pointerUp(point(120))).toEqual({});
  });
});
