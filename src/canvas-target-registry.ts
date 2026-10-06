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
  private roots = new Set<HTMLElement>();

  replaceRoots(roots: Iterable<HTMLElement>): void {
    this.roots = new Set(roots);
  }

  clear(): void {
    this.roots.clear();
  }

  getWindows(): Set<Window> {
    const windows = new Set<Window>();
    for (const root of this.roots) {
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

  private findContainingRoot(node: Node): HTMLElement | null {
    for (const root of this.roots) {
      if (root === node || root.contains(node)) {
        return root;
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
