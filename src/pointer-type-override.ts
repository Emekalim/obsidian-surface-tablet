import type { CanvasTargetRegistry } from "./canvas-target-registry";
import type { SurfaceTabletModeSnapshot } from "./mode-state";

type PatchedProperty = "pointerType" | "button" | "buttons" | "isPrimary";
type Getter = (this: PointerEvent) => unknown;

interface DescriptorSnapshot {
  ownDescriptor: PropertyDescriptor | undefined;
  resolvedDescriptor: PropertyDescriptor;
}

interface InstalledProperty {
  getter: Getter;
  snapshot: DescriptorSnapshot;
}

export interface PointerPatchDependencies {
  canvasTargets: CanvasTargetRegistry;
  isActiveCanvasPointer: (event: PointerEvent) => boolean;
  getModeState: () => Readonly<SurfaceTabletModeSnapshot>;
  onError: (message: string, error?: unknown) => void;
}

/**
 * Installs reversible accessors on one Window's PointerEvent prototype.
 * Each accessor delegates to the descriptor that existed before this patch.
 */
export class WindowPointerPatch {
  private readonly prototype: object;
  private readonly installed = new Map<PatchedProperty, InstalledProperty>();
  private active = false;

  constructor(
    private readonly ownerWindow: Window,
    private readonly dependencies: PointerPatchDependencies,
  ) {
    const PointerEventConstructor = (ownerWindow as Window & { PointerEvent?: typeof PointerEvent })
      .PointerEvent;
    if (!PointerEventConstructor) {
      throw new Error("PointerEvent is not available in this window");
    }
    this.prototype = PointerEventConstructor.prototype;
  }

  install(): void {
    if (this.isIntact()) {
      return;
    }
    if (this.active) {
      this.active = false;
      this.restoreOwnedGetters();
    }

    const snapshots = new Map<PatchedProperty, DescriptorSnapshot>();
    for (const property of ["pointerType", "button", "buttons", "isPrimary"] as const) {
      snapshots.set(property, this.snapshotDescriptor(property));
    }

    const rawPointerType = requiredGetter(snapshots.get("pointerType"), "pointerType");
    const rawButton = requiredGetter(snapshots.get("button"), "button");
    const rawButtons = requiredGetter(snapshots.get("buttons"), "buttons");
    const rawIsPrimary = requiredGetter(snapshots.get("isPrimary"), "isPrimary");

    const pointerTypeGetter: Getter = function (this: PointerEvent): string {
      const actual = String(rawPointerType.call(this));
      if (!patchShouldTransform(this, actual)) {
        return actual;
      }
      return "mouse";
    };

    const buttonGetter: Getter = function (this: PointerEvent): number {
      return Number(rawButton.call(this));
    };

    const buttonsGetter: Getter = function (this: PointerEvent): number {
      return Number(rawButtons.call(this));
    };

    const isPrimaryGetter: Getter = function (this: PointerEvent): boolean {
      const actual = Boolean(rawIsPrimary.call(this));
      const actualType = String(rawPointerType.call(this));
      if (!patchShouldTransform(this, actualType)) {
        return actual;
      }
      return true;
    };

    const dependencies = this.dependencies;
    const isActive = (): boolean => this.active;

    function patchShouldTransform(event: PointerEvent, actualType: string): boolean {
      if (!isActive() || actualType !== "pen") {
        return false;
      }
      const mode = dependencies.getModeState();
      return (
        mode.tabletModeEnabled &&
        (dependencies.canvasTargets.isEligibleCanvasEvent(event) ||
          dependencies.isActiveCanvasPointer(event))
      );
    }

    const getters: Record<PatchedProperty, Getter> = {
      pointerType: pointerTypeGetter,
      button: buttonGetter,
      buttons: buttonsGetter,
      isPrimary: isPrimaryGetter,
    };

    try {
      for (const property of ["pointerType", "button", "buttons", "isPrimary"] as const) {
        const snapshot = snapshots.get(property);
        if (!snapshot) {
          throw new Error(`Missing descriptor snapshot for ${property}`);
        }
        const getter = getters[property];
        Object.defineProperty(this.prototype, property, {
          configurable: true,
          enumerable: snapshot.resolvedDescriptor.enumerable ?? true,
          get: getter,
        });
        this.installed.set(property, { getter, snapshot });
      }
      this.active = true;
    } catch (error) {
      this.active = false;
      this.restoreOwnedGetters();
      throw error;
    }
  }

  uninstall(): void {
    this.active = false;
    this.restoreOwnedGetters();
  }

  isIntact(): boolean {
    if (!this.active || this.installed.size !== 4) {
      return false;
    }
    for (const [property, installed] of this.installed) {
      if (Object.getOwnPropertyDescriptor(this.prototype, property)?.get !== installed.getter) {
        return false;
      }
    }
    return true;
  }

  readRawPointerType(event: PointerEvent): string {
    return String(this.callRawGetter("pointerType", event));
  }

  readRawButton(event: PointerEvent): number {
    return Number(this.callRawGetter("button", event));
  }

  readRawButtons(event: PointerEvent): number {
    return Number(this.callRawGetter("buttons", event));
  }

  readRawIsPrimary(event: PointerEvent): boolean {
    return Boolean(this.callRawGetter("isPrimary", event));
  }

  private callRawGetter(property: PatchedProperty, event: PointerEvent): unknown {
    const installed = this.installed.get(property);
    if (!installed) {
      throw new Error(`Pointer patch is not installed for ${property}`);
    }
    return requiredGetter(installed.snapshot, property).call(event);
  }

  private snapshotDescriptor(property: PatchedProperty): DescriptorSnapshot {
    const ownDescriptor = Object.getOwnPropertyDescriptor(this.prototype, property);
    if (ownDescriptor && ownDescriptor.configurable === false) {
      throw new Error(`PointerEvent.prototype.${property} is not configurable`);
    }

    const resolvedDescriptor = findPropertyDescriptor(this.prototype, property);
    if (!resolvedDescriptor || typeof resolvedDescriptor.get !== "function") {
      throw new Error(`PointerEvent.prototype.${property} does not expose a getter`);
    }

    return { ownDescriptor, resolvedDescriptor };
  }

  private restoreOwnedGetters(): void {
    for (const [property, installed] of [...this.installed].reverse()) {
      const current = Object.getOwnPropertyDescriptor(this.prototype, property);
      if (current?.get !== installed.getter) {
        continue;
      }

      try {
        if (installed.snapshot.ownDescriptor) {
          Object.defineProperty(this.prototype, property, installed.snapshot.ownDescriptor);
        } else {
          Reflect.deleteProperty(this.prototype, property);
        }
      } catch (error) {
        this.dependencies.onError(`Could not restore PointerEvent.prototype.${property}`, error);
      }
    }
    this.installed.clear();
  }
}

function findPropertyDescriptor(
  prototype: object,
  property: PropertyKey,
): PropertyDescriptor | null {
  let current: object | null = prototype;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) {
      return descriptor;
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return null;
}

function requiredGetter(
  snapshot: DescriptorSnapshot | undefined,
  property: PatchedProperty,
): Getter {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- native getter is kept unbound and always invoked via .call(event)
  const getter = snapshot?.resolvedDescriptor.get;
  if (typeof getter !== "function") {
    throw new Error(`Missing native getter for PointerEvent.prototype.${property}`);
  }
  return getter as Getter;
}
