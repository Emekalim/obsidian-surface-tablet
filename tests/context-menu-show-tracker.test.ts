import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenuShowTracker, type MenuWithMouseShow } from "../src/context-menu-show-tracker";

class FakeMenu implements MenuWithMouseShow {
  showAtMouseEvent(event: MouseEvent): this {
    void event;
    return this;
  }

  showAtPosition(position: { x: number; y: number }, document?: Document): this {
    void position;
    void document;
    return this;
  }
}

describe("ContextMenuShowTracker", () => {
  let tracker: ContextMenuShowTracker<FakeMenu> | null = null;

  afterEach(() => {
    tracker?.uninstall();
    vi.restoreAllMocks();
  });

  it("captures the exact menu after its original show method runs", () => {
    const order: string[] = [];
    const original = vi.spyOn(FakeMenu.prototype, "showAtMouseEvent").mockImplementation(function (
      this: FakeMenu,
    ) {
      order.push("canvas-show");
      return this;
    });
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    const event = new MouseEvent("contextmenu");
    const menu = new FakeMenu();
    let captured: MenuWithMouseShow | null = null;
    tracker.watch(event, (shownMenu) => {
      order.push("plugin-capture");
      captured = shownMenu;
    });

    expect(menu.showAtMouseEvent(event)).toBe(menu);
    expect(captured).toBe(menu);
    expect(order).toEqual(["canvas-show", "plugin-capture"]);
    expect(original).toHaveBeenCalledOnce();
  });

  it("ignores menus shown for unrelated events", () => {
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    const watchedEvent = new MouseEvent("contextmenu");
    const unrelatedEvent = new MouseEvent("contextmenu");
    const callback = vi.fn();
    tracker.watch(watchedEvent, callback);

    new FakeMenu().showAtMouseEvent(unrelatedEvent);

    expect(callback).not.toHaveBeenCalled();
  });

  it("captures the exact positioned menu after its original show method runs", () => {
    const order: string[] = [];
    vi.spyOn(FakeMenu.prototype, "showAtPosition").mockImplementation(function (this: FakeMenu) {
      order.push("canvas-show");
      return this;
    });
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    const event = new MouseEvent("contextmenu", { clientX: 120, clientY: 80 });
    const menu = new FakeMenu();
    let captured: MenuWithMouseShow | null = null;
    tracker.watch(event, (shownMenu) => {
      order.push("plugin-capture");
      captured = shownMenu;
    });

    expect(menu.showAtPosition({ x: 120, y: 80 }, document)).toBe(menu);
    expect(captured).toBe(menu);
    expect(order).toEqual(["canvas-show", "plugin-capture"]);
  });

  it("ignores positioned menus outside the watched event coordinates", () => {
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    const event = new MouseEvent("contextmenu", { clientX: 10, clientY: 20 });
    const callback = vi.fn();
    tracker.watch(event, callback);

    new FakeMenu().showAtPosition({ x: 110, y: 120 }, document);

    expect(callback).not.toHaveBeenCalled();
  });

  it("restores only its own wrapper during uninstall", () => {
    const original = FakeMenu.prototype.showAtMouseEvent;
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    expect(FakeMenu.prototype.showAtMouseEvent).not.toBe(original);

    tracker.uninstall();

    expect(FakeMenu.prototype.showAtMouseEvent).toBe(original);
  });

  it("does not overwrite a later wrapper installed by another plugin", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      FakeMenu.prototype,
      "showAtMouseEvent",
    );
    tracker = new ContextMenuShowTracker(FakeMenu.prototype);
    tracker.install();
    const laterWrapper = vi.fn(function (this: FakeMenu) {
      return this;
    });
    Object.defineProperty(FakeMenu.prototype, "showAtMouseEvent", {
      ...originalDescriptor,
      value: laterWrapper,
    });

    tracker.uninstall();

    expect(FakeMenu.prototype.showAtMouseEvent).toBe(laterWrapper);
    if (originalDescriptor) {
      Object.defineProperty(FakeMenu.prototype, "showAtMouseEvent", originalDescriptor);
    }
  });
});
