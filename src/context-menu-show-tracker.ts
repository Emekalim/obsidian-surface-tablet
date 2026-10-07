export interface MenuWithMouseShow {
  showAtMouseEvent: (event: MouseEvent) => unknown;
  showAtPosition: (position: MenuPosition, document?: Document) => unknown;
}

export interface MenuPosition {
  x: number;
  y: number;
}

interface MenuWatch<TMenu> {
  event: MouseEvent;
  callback: (menu: TMenu) => void;
}

interface PositionedMenuWatch<TMenu> {
  watch: MenuWatch<TMenu>;
}

/** Observes the exact Obsidian Menu instance shown for a specific context-menu event. */
export class ContextMenuShowTracker<TMenu extends MenuWithMouseShow = MenuWithMouseShow> {
  private originalMouseDescriptor: PropertyDescriptor | null = null;
  private originalPositionDescriptor: PropertyDescriptor | null = null;
  private mouseReplacement: MenuWithMouseShow["showAtMouseEvent"] | null = null;
  private positionReplacement: MenuWithMouseShow["showAtPosition"] | null = null;
  private watchers = new WeakMap<MouseEvent, MenuWatch<TMenu>>();
  private positionedWatch: PositionedMenuWatch<TMenu> | null = null;
  private installed = false;

  constructor(
    private readonly menuPrototype: TMenu,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  install(): void {
    if (this.installed) {
      return;
    }

    const mouseDescriptor = Object.getOwnPropertyDescriptor(this.menuPrototype, "showAtMouseEvent");
    const positionDescriptor = Object.getOwnPropertyDescriptor(
      this.menuPrototype,
      "showAtPosition",
    );
    if (!mouseDescriptor || typeof mouseDescriptor.value !== "function") {
      throw new Error("Obsidian Menu.showAtMouseEvent is unavailable");
    }
    if (!positionDescriptor || typeof positionDescriptor.value !== "function") {
      throw new Error("Obsidian Menu.showAtPosition is unavailable");
    }

    const originalMouse = mouseDescriptor.value as MenuWithMouseShow["showAtMouseEvent"];
    const originalPosition = positionDescriptor.value as MenuWithMouseShow["showAtPosition"];
    const captureMouse = (event: MouseEvent, menu: TMenu): void =>
      this.captureMouseEvent(event, menu);
    const capturePosition = (
      position: MenuPosition,
      document: Document | undefined,
      menu: TMenu,
    ): void => this.capturePosition(position, document, menu);
    const mouseReplacement = function (this: TMenu, event: MouseEvent): unknown {
      const result = originalMouse.call(this, event);
      captureMouse(event, this);
      return result;
    };
    const positionReplacement = function (
      this: TMenu,
      position: MenuPosition,
      document?: Document,
    ): unknown {
      const result = originalPosition.call(this, position, document);
      capturePosition(position, document, this);
      return result;
    };

    Object.defineProperty(this.menuPrototype, "showAtMouseEvent", {
      ...mouseDescriptor,
      value: mouseReplacement,
    });
    try {
      Object.defineProperty(this.menuPrototype, "showAtPosition", {
        ...positionDescriptor,
        value: positionReplacement,
      });
    } catch (error) {
      Object.defineProperty(this.menuPrototype, "showAtMouseEvent", mouseDescriptor);
      throw error;
    }

    this.originalMouseDescriptor = mouseDescriptor;
    this.originalPositionDescriptor = positionDescriptor;
    this.mouseReplacement = mouseReplacement;
    this.positionReplacement = positionReplacement;
    this.installed = true;
  }

  watch(event: MouseEvent, callback: (menu: TMenu) => void): () => void {
    const watch = { event, callback };
    this.watchers.set(event, watch);
    const positionedWatch = { watch };
    this.positionedWatch = positionedWatch;
    return () => {
      if (this.watchers.get(event) === watch) {
        this.watchers.delete(event);
      }
      if (this.positionedWatch === positionedWatch) {
        this.positionedWatch = null;
      }
    };
  }

  uninstall(): void {
    this.installed = false;
    this.watchers = new WeakMap();
    this.positionedWatch = null;

    const mouseDescriptor = Object.getOwnPropertyDescriptor(this.menuPrototype, "showAtMouseEvent");
    if (mouseDescriptor?.value === this.mouseReplacement && this.originalMouseDescriptor) {
      Object.defineProperty(this.menuPrototype, "showAtMouseEvent", this.originalMouseDescriptor);
    }
    const positionDescriptor = Object.getOwnPropertyDescriptor(
      this.menuPrototype,
      "showAtPosition",
    );
    if (positionDescriptor?.value === this.positionReplacement && this.originalPositionDescriptor) {
      Object.defineProperty(this.menuPrototype, "showAtPosition", this.originalPositionDescriptor);
    }

    this.originalMouseDescriptor = null;
    this.originalPositionDescriptor = null;
    this.mouseReplacement = null;
    this.positionReplacement = null;
  }

  private captureMouseEvent(event: MouseEvent, menu: TMenu): void {
    if (!this.installed) {
      return;
    }
    const watch = this.watchers.get(event);
    if (watch) {
      this.invoke(watch, menu);
    }
  }

  private capturePosition(
    position: MenuPosition,
    document: Document | undefined,
    menu: TMenu,
  ): void {
    const watch = this.positionedWatch?.watch;
    if (!this.installed || !watch) {
      return;
    }
    if (positionMatchesEvent(position, document, watch.event)) {
      this.invoke(watch, menu);
    }
  }

  private invoke(watch: MenuWatch<TMenu>, menu: TMenu): void {
    this.watchers.delete(watch.event);
    if (this.positionedWatch?.watch === watch) {
      this.positionedWatch = null;
    }
    try {
      watch.callback(menu);
    } catch (error) {
      this.onError(error);
    }
  }
}

function positionMatchesEvent(
  position: MenuPosition,
  document: Document | undefined,
  event: MouseEvent,
): boolean {
  const targetDocument = eventTargetDocument(event.target);
  if (document && targetDocument && document !== targetDocument) {
    return false;
  }
  return Math.hypot(position.x - event.clientX, position.y - event.clientY) <= 32;
}

function eventTargetDocument(target: EventTarget | null): Document | null {
  if (!target || typeof target !== "object" || !("ownerDocument" in target)) {
    return null;
  }
  return (target as { ownerDocument?: Document | null }).ownerDocument ?? null;
}
