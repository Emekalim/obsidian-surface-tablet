import { beforeEach, describe, expect, it } from "vitest";
import { CanvasTargetRegistry } from "../src/canvas-target-registry";

describe("CanvasTargetRegistry", () => {
  let registry: CanvasTargetRegistry;
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    registry = new CanvasTargetRegistry();
    root = document.createElement("div");
    document.body.append(root);
    registry.replaceRoots([root]);
  });

  it("accepts ordinary Canvas card surfaces", () => {
    const card = document.createElement("div");
    card.className = "canvas-node";
    root.append(card);
    expect(registry.isEligibleCanvasEvent(eventFor(card))).toBe(true);
  });

  it("rejects active editors and embedded content", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const iframe = document.createElement("iframe");
    root.append(editor, iframe);

    expect(registry.isEligibleCanvasEvent(eventFor(editor))).toBe(false);
    expect(registry.isEligibleCanvasEvent(eventFor(iframe))).toBe(false);
  });

  it("rejects targets outside registered Canvas views", () => {
    const outside = document.createElement("div");
    document.body.append(outside);
    expect(registry.isEligibleCanvasEvent(eventFor(outside))).toBe(false);
  });

  it("returns the windows that own registered roots", () => {
    expect(registry.getWindows()).toEqual(new Set([window]));
  });
});

function eventFor(target: EventTarget): Event {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "target", { configurable: true, value: target });
  return event;
}
