import type { CanvasViewport } from "./canvas-pan-controller";

const NATIVE_PEN_TARGET_SELECTOR = [
  "input",
  "textarea",
  "select",
  "option",
  "iframe",
  "embed",
  "object",
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[role="textbox"]',
  ".cm-editor",
  ".markdown-source-view",
  ".pdf-container",
  ".pdf-viewer",
  ".excalidraw",
  ".excalidraw-wrapper",
].join(",");

/** Tracks the public content roots of loaded Canvas FileViews. */
export class CanvasTargetRegistry {
  private registrations = new Map<HTMLElement, () => CanvasViewport | null>();

  replaceRoots(roots: Iterable<HTMLElement>): void {
    this.registrations = new Map([...roots].map((root) => [root, () => null]));
  }

  replaceTargets(
    targets: Iterable<{ root: HTMLElement; getViewport: () => CanvasViewport | null }>,
  ): void {
    this.registrations = new Map([...targets].map(({ root, getViewport }) => [root, getViewport]));
  }

  clear(): void {
    this.registrations.clear();
  }

  getWindows(): Set<Window> {
    const windows = new Set<Window>();
    for (const root of this.registrations.keys()) {
      const ownerWindow = root.ownerDocument.defaultView;
      if (ownerWindow) {
        windows.add(ownerWindow);
      }
    }
    return windows;
  }

  isEligibleCanvasEvent(event: Event): boolean {
    const element = eventOriginElement(event);
    if (!element) {
      return false;
    }

    const root = this.findContainingRoot(element);
    if (!root) {
      return false;
    }

    const nativeTarget = element.closest(NATIVE_PEN_TARGET_SELECTOR);
    return !nativeTarget || !root.contains(nativeTarget);
  }

  getViewportForEvent(event: Event): CanvasViewport | null {
    const element = eventOriginElement(event);
    if (!element) {
      return null;
    }
    return this.findContainingRegistration(element)?.getViewport() ?? null;
  }

  private findContainingRoot(node: Node): HTMLElement | null {
    return this.findContainingRegistration(node)?.root ?? null;
  }

  private findContainingRegistration(
    node: Node,
  ): { root: HTMLElement; getViewport: () => CanvasViewport | null } | null {
    for (const [root, getViewport] of this.registrations) {
      if (root === node || root.contains(node)) {
        return { root, getViewport };
      }
    }
    return null;
  }
}

function eventOriginElement(event: Event): Element | null {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const origin = path[0] ?? event.target;

  if (!isNode(origin)) {
    return null;
  }

  return origin.nodeType === 1 ? (origin as Element) : origin.parentElement;
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "nodeType" in value;
}
