import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowPointerPatch } from "../src/pointer-type-override";

class FakeMouseEvent {
  constructor(
    private readonly nativeButton: number,
    private readonly nativeButtons: number,
  ) {}

  get button(): number {
    return this.nativeButton;
  }

  get buttons(): number {
    return this.nativeButtons;
  }
}

class FakePointerEvent extends FakeMouseEvent {
  constructor(
    private readonly nativePointerType: string,
    button: number,
    buttons: number,
    readonly target: object = {},
    readonly pointerId = 1,
    private readonly nativeIsPrimary = true,
  ) {
    super(button, buttons);
  }

  get pointerType(): string {
    return this.nativePointerType;
  }

  get isPrimary(): boolean {
    return this.nativeIsPrimary;
  }
}

const fakeWindow = (): Window => ({ PointerEvent: FakePointerEvent }) as unknown as Window;

const originalPointerTypeDescriptor = Object.getOwnPropertyDescriptor(
  FakePointerEvent.prototype,
  "pointerType",
);
const originalIsPrimaryDescriptor = Object.getOwnPropertyDescriptor(
  FakePointerEvent.prototype,
  "isPrimary",
);

afterEach(() => {
  if (originalPointerTypeDescriptor) {
    Object.defineProperty(FakePointerEvent.prototype, "pointerType", originalPointerTypeDescriptor);
  }
  if (originalIsPrimaryDescriptor) {
    Object.defineProperty(FakePointerEvent.prototype, "isPrimary", originalIsPrimaryDescriptor);
  }
  Reflect.deleteProperty(FakePointerEvent.prototype, "button");
  Reflect.deleteProperty(FakePointerEvent.prototype, "buttons");
});

describe("WindowPointerPatch", () => {
  it("converts only eligible pen events while Tablet Mode is on", () => {
    const state = { tabletModeEnabled: true, panModeEnabled: false };
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => state,
      onError: vi.fn(),
    });
    patch.install();

    const pen = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    const mouse = new FakePointerEvent("mouse", 0, 1) as unknown as PointerEvent;
    expect(pen.pointerType).toBe("mouse");
    expect(mouse.pointerType).toBe("mouse");
    expect(pen.button).toBe(0);
    expect(pen.buttons).toBe(1);

    patch.uninstall();
    expect(pen.pointerType).toBe("pen");
  });

  it("reports a restored non-primary Canvas pen as primary only in Tablet Mode", () => {
    const state = { tabletModeEnabled: true, panModeEnabled: false };
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => state,
      onError: vi.fn(),
    });
    patch.install();

    const restoredPen = new FakePointerEvent("pen", 0, 1, {}, 13, false) as unknown as PointerEvent;
    const secondaryMouse = new FakePointerEvent(
      "mouse",
      0,
      1,
      {},
      1,
      false,
    ) as unknown as PointerEvent;
    const secondaryTouch = new FakePointerEvent(
      "touch",
      0,
      1,
      {},
      2,
      false,
    ) as unknown as PointerEvent;
    expect(restoredPen.pointerType).toBe("mouse");
    expect(restoredPen.isPrimary).toBe(true);
    expect(secondaryMouse.isPrimary).toBe(false);
    expect(secondaryTouch.isPrimary).toBe(false);

    state.tabletModeEnabled = false;
    expect(restoredPen.pointerType).toBe("pen");
    expect(restoredPen.isPrimary).toBe(false);
    patch.uninstall();
  });

  it("leaves pen properties native in persistent Pan Mode for the direct pan controller", () => {
    const state = { tabletModeEnabled: false, panModeEnabled: true };
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => state,
      onError: vi.fn(),
    });
    patch.install();

    const tip = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    const barrel = new FakePointerEvent("pen", 2, 2) as unknown as PointerEvent;
    expect(tip.pointerType).toBe("pen");
    expect(tip.button).toBe(0);
    expect(tip.buttons).toBe(1);
    expect(barrel.button).toBe(2);
    expect(barrel.buttons).toBe(2);

    patch.uninstall();
  });

  it("leaves ineligible Canvas targets native", () => {
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => false } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => ({ tabletModeEnabled: true, panModeEnabled: true }),
      onError: vi.fn(),
    });
    patch.install();
    const event = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    expect(event.pointerType).toBe("pen");
    expect(event.button).toBe(0);
    expect(event.buttons).toBe(1);
    patch.uninstall();
  });

  it("does not overwrite a later plugin's getter during unload", () => {
    const ownerWindow = fakeWindow();
    const patch = new WindowPointerPatch(ownerWindow, {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => ({ tabletModeEnabled: true, panModeEnabled: false }),
      onError: vi.fn(),
    });
    patch.install();

    const prototype = (ownerWindow as Window & { PointerEvent: typeof PointerEvent }).PointerEvent
      .prototype;
    const ours = Object.getOwnPropertyDescriptor(prototype, "pointerType")?.get;
    expect(ours).toBeTypeOf("function");
    const laterGetter = function (this: PointerEvent): unknown {
      return ours?.call(this);
    };
    Object.defineProperty(prototype, "pointerType", {
      configurable: true,
      get: laterGetter,
    });

    patch.uninstall();
    expect(Object.getOwnPropertyDescriptor(prototype, "pointerType")?.get).toBe(laterGetter);
    const event = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    expect(event.pointerType).toBe("pen");
  });

  it("keeps an active Canvas pointer mouse-like when a drag event is retargeted", () => {
    const canvasTarget = {};
    const outsideTarget = {};
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: {
        isEligibleCanvasEvent: (event: PointerEvent) => event.target === canvasTarget,
      } as never,
      isActiveCanvasPointer: (event: PointerEvent) => event.pointerId === 42,
      getModeState: () => ({ tabletModeEnabled: true, panModeEnabled: false }),
      onError: vi.fn(),
    } as never);
    patch.install();

    const down = new FakePointerEvent("pen", 0, 1, canvasTarget, 42) as unknown as PointerEvent;
    const move = new FakePointerEvent("pen", -1, 1, outsideTarget, 42) as unknown as PointerEvent;
    expect(down.pointerType).toBe("mouse");
    expect(move.pointerType).toBe("mouse");
    patch.uninstall();
  });

  it("can reinstall after its getter is replaced during a window lifecycle transition", () => {
    const ownerWindow = fakeWindow();
    const patch = new WindowPointerPatch(ownerWindow, {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      isActiveCanvasPointer: () => false,
      getModeState: () => ({ tabletModeEnabled: true, panModeEnabled: false }),
      onError: vi.fn(),
    });
    patch.install();

    const prototype = (ownerWindow as Window & { PointerEvent: typeof PointerEvent }).PointerEvent
      .prototype;
    if (originalPointerTypeDescriptor) {
      Object.defineProperty(prototype, "pointerType", originalPointerTypeDescriptor);
    }

    patch.install();
    const event = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    expect(event.pointerType).toBe("mouse");
    patch.uninstall();
  });
});
