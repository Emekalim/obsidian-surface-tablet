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
  readonly target = {};

  constructor(
    private readonly nativePointerType: string,
    button: number,
    buttons: number,
  ) {
    super(button, buttons);
  }

  get pointerType(): string {
    return this.nativePointerType;
  }
}

const fakeWindow = (): Window => ({ PointerEvent: FakePointerEvent }) as unknown as Window;

const originalPointerTypeDescriptor = Object.getOwnPropertyDescriptor(
  FakePointerEvent.prototype,
  "pointerType",
);

afterEach(() => {
  if (originalPointerTypeDescriptor) {
    Object.defineProperty(FakePointerEvent.prototype, "pointerType", originalPointerTypeDescriptor);
  }
  Reflect.deleteProperty(FakePointerEvent.prototype, "button");
  Reflect.deleteProperty(FakePointerEvent.prototype, "buttons");
});

describe("WindowPointerPatch", () => {
  it("converts only eligible pen events while Tablet Mode is on", () => {
    const state = { tabletModeEnabled: true, panModeEnabled: false };
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
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

  it("maps a pen tip to middle-button semantics only in Pan Mode", () => {
    const state = { tabletModeEnabled: false, panModeEnabled: true };
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => true } as never,
      getModeState: () => state,
      onError: vi.fn(),
    });
    patch.install();

    const tip = new FakePointerEvent("pen", 0, 1) as unknown as PointerEvent;
    const barrel = new FakePointerEvent("pen", 2, 2) as unknown as PointerEvent;
    expect(tip.pointerType).toBe("mouse");
    expect(tip.button).toBe(1);
    expect(tip.buttons).toBe(4);
    expect(barrel.button).toBe(2);
    expect(barrel.buttons).toBe(2);

    patch.uninstall();
  });

  it("leaves ineligible Canvas targets native", () => {
    const patch = new WindowPointerPatch(fakeWindow(), {
      canvasTargets: { isEligibleCanvasEvent: () => false } as never,
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
});
