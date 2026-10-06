import { Notice, Platform, Plugin } from "obsidian";
import { CanvasTargetRegistry } from "./canvas-target-registry";
import { CanvasToolbarController } from "./canvas-toolbar-controller";
import { CanvasPanController } from "./canvas-pan-controller";
import { SurfaceTabletModeState } from "./mode-state";
import { PenGestureController } from "./pen-gesture-controller";
import { WindowPointerPatch } from "./pointer-type-override";
import { DEFAULT_SETTINGS, sanitizeSettings, type SurfaceTabletSettings } from "./settings";
import { SurfaceTabletSettingTab } from "./settings-tab";

type ToggleSource = "command" | "toolbar" | "pen";

interface WindowRuntime {
  patch: WindowPointerPatch;
  gestures: PenGestureController;
}

export default class SurfaceTabletPlugin extends Plugin {
  override settings: SurfaceTabletSettings = { ...DEFAULT_SETTINGS };
  readonly supportedPlatform = Platform.isDesktopApp && Platform.isWin;

  private modeState!: SurfaceTabletModeState;
  private readonly canvasTargets = new CanvasTargetRegistry();
  private readonly panController = new CanvasPanController();
  private canvasToolbar: CanvasToolbarController | null = null;
  private readonly windowRuntimes = new Map<Window, WindowRuntime>();
  private readonly failedWindows = new WeakSet<Window>();
  private syncQueued = false;
  private unsubscribeMode: (() => void) | null = null;

  override async onload(): Promise<void> {
    this.settings = sanitizeSettings(await this.loadData());
    this.modeState = new SurfaceTabletModeState(this.settings.enableTabletModeOnStartup);

    this.addSettingTab(new SurfaceTabletSettingTab(this.app, this));
    this.registerCommands();

    if (!this.supportedPlatform) {
      return;
    }

    this.canvasToolbar = new CanvasToolbarController(this.app, this.canvasTargets, {
      supported: true,
      shouldShowControls: () => this.settings.showCanvasControls,
      getModeState: () => this.modeState.snapshot(),
      toggleTabletMode: () => this.toggleTabletMode("toolbar"),
      togglePanMode: () => this.togglePanMode("toolbar"),
    });

    this.unsubscribeMode = this.modeState.subscribe(() => this.canvasToolbar?.refresh());

    this.registerEvent(this.app.workspace.on("layout-change", this.queueEnvironmentSync));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.queueEnvironmentSync));
    this.registerEvent(this.app.workspace.on("window-open", this.queueEnvironmentSync));
    this.registerEvent(this.app.workspace.on("window-close", this.queueEnvironmentSync));
    this.app.workspace.onLayoutReady(this.queueEnvironmentSync);
  }

  override onunload(): void {
    this.unsubscribeMode?.();
    this.unsubscribeMode = null;

    for (const runtime of this.windowRuntimes.values()) {
      runtime.gestures.destroy();
      runtime.patch.uninstall();
    }
    this.windowRuntimes.clear();

    this.canvasToolbar?.destroy();
    this.canvasToolbar = null;
  }

  async saveSettings(): Promise<void> {
    this.settings = sanitizeSettings(this.settings);
    await this.saveData(this.settings);
    this.queueEnvironmentSync();
  }

  private registerCommands(): void {
    this.addCommand({
      id: "toggle-mouse-emulation",
      name: "Tablet Mode: Toggle mouse emulation",
      callback: () => this.toggleTabletMode("command"),
    });

    this.addCommand({
      id: "enable-mouse-emulation",
      name: "Tablet Mode: Enable mouse emulation",
      callback: () => this.setTabletMode(true, "command"),
    });

    this.addCommand({
      id: "disable-mouse-emulation",
      name: "Tablet Mode: Disable mouse emulation",
      callback: () => this.setTabletMode(false, "command"),
    });

    this.addCommand({
      id: "toggle-pan-mode",
      name: "Tablet Mode: Toggle pan mode",
      callback: () => this.togglePanMode("command"),
    });

    this.addCommand({
      id: "clear-pen-diagnostics",
      name: "Tablet Mode: Clear pen diagnostics",
      callback: () => this.clearPenDiagnostics(),
    });

    this.addCommand({
      id: "copy-pen-diagnostics",
      name: "Tablet Mode: Copy pen diagnostics",
      callback: () => void this.copyPenDiagnostics(),
    });
  }

  private readonly queueEnvironmentSync = (): void => {
    if (this.syncQueued || !this.supportedPlatform) {
      return;
    }
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      this.syncEnvironment();
    });
  };

  private syncEnvironment(): void {
    if (!this.canvasToolbar) {
      return;
    }

    this.canvasToolbar.sync();
    const currentWindows = this.canvasTargets.getWindows();
    currentWindows.add(window);

    for (const [ownerWindow, runtime] of this.windowRuntimes) {
      if (!currentWindows.has(ownerWindow) || ownerWindow.closed) {
        runtime.gestures.destroy();
        runtime.patch.uninstall();
        this.windowRuntimes.delete(ownerWindow);
      } else if (!runtime.patch.isIntact()) {
        try {
          runtime.patch.install();
          this.debug("Reinstalled input handling after window lifecycle change");
        } catch (error) {
          runtime.gestures.destroy();
          runtime.patch.uninstall();
          this.windowRuntimes.delete(ownerWindow);
          this.failedWindows.add(ownerWindow);
          this.reportError(
            "Could not restore input handling after a window lifecycle change",
            error,
          );
          new Notice("Surface Tablet: Input emulation could not be restored in this window.");
        }
      }
    }

    for (const ownerWindow of currentWindows) {
      if (
        this.windowRuntimes.has(ownerWindow) ||
        this.failedWindows.has(ownerWindow) ||
        ownerWindow.closed
      ) {
        continue;
      }
      this.installWindow(ownerWindow);
    }
  }

  private installWindow(ownerWindow: Window): void {
    let gestures: PenGestureController | null = null;
    const patch = new WindowPointerPatch(ownerWindow, {
      canvasTargets: this.canvasTargets,
      isActiveCanvasPointer: (event) => gestures?.isActiveCanvasPointer(event) ?? false,
      getModeState: () => this.modeState.snapshot(),
      onError: (message, error) => this.reportError(message, error),
    });

    try {
      patch.install();
      gestures = new PenGestureController(ownerWindow, {
        pointerPatch: patch,
        canvasTargets: this.canvasTargets,
        panController: this.panController,
        getSettings: () => this.settings,
        getModeState: () => this.modeState.snapshot(),
        toggleTabletMode: () => this.toggleTabletMode("pen"),
        requestEnvironmentSync: this.queueEnvironmentSync,
        debug: (message, details) => this.debug(message, details),
      });
      this.windowRuntimes.set(ownerWindow, { patch, gestures });
      this.debug("Installed input handling for Obsidian window");
    } catch (error) {
      patch.uninstall();
      this.failedWindows.add(ownerWindow);
      this.reportError("Input emulation is unavailable in one Obsidian window", error);
      new Notice("Surface Tablet: Input emulation is unavailable in this window.");
    }
  }

  private toggleTabletMode(source: ToggleSource): void {
    if (!this.ensureSupported()) {
      return;
    }
    const enabled = this.modeState.toggleTabletMode();
    this.debug(`Mouse emulation ${enabled ? "enabled" : "disabled"}`, { source });
    if (source !== "toolbar") {
      new Notice(
        enabled ? "Surface Tablet: Mouse emulation enabled" : "Surface Tablet: Native pen enabled",
      );
    }
  }

  private setTabletMode(enabled: boolean, source: ToggleSource): void {
    if (!this.ensureSupported()) {
      return;
    }
    this.modeState.setTabletMode(enabled);
    this.debug(`Mouse emulation ${enabled ? "enabled" : "disabled"}`, { source });
    if (source !== "toolbar") {
      new Notice(
        enabled ? "Surface Tablet: Mouse emulation enabled" : "Surface Tablet: Native pen enabled",
      );
    }
  }

  private togglePanMode(source: ToggleSource): void {
    if (!this.ensureSupported()) {
      return;
    }
    const enabled = this.modeState.togglePanMode();
    this.debug(`Pan mode ${enabled ? "enabled" : "disabled"}`, { source });
    if (source !== "toolbar") {
      new Notice(`Surface Tablet: Pan mode ${enabled ? "enabled" : "disabled"}`);
    }
  }

  private ensureSupported(): boolean {
    if (this.supportedPlatform) {
      return true;
    }
    new Notice("Surface Tablet v1 supports Obsidian Desktop on Windows only.");
    return false;
  }

  private clearPenDiagnostics(): void {
    for (const runtime of this.windowRuntimes.values()) {
      runtime.gestures.clearDiagnostics();
    }
    new Notice("Surface Tablet: Pen diagnostics cleared.");
  }

  private async copyPenDiagnostics(): Promise<void> {
    const events = [...this.windowRuntimes.entries()]
      .flatMap(([, runtime], windowIndex) =>
        runtime.gestures.getDiagnostics().map((entry) => ({ windowIndex, ...entry })),
      )
      .sort((left, right) =>
        left.capturedAt === right.capturedAt
          ? left.sequence - right.sequence
          : left.capturedAt - right.capturedAt,
      );
    const payload = JSON.stringify(
      {
        schema: "surface-tablet-pen-diagnostics-v1",
        exportedAt: new Date().toISOString(),
        pluginVersion: this.manifest.version,
        platform: window.navigator.platform,
        userAgent: window.navigator.userAgent,
        settings: {
          enableBarrelDoubleClick: this.settings.enableBarrelDoubleClick,
          doubleClickIntervalMs: this.settings.doubleClickIntervalMs,
          enableBarrelPan: this.settings.enableBarrelPan,
          panThresholdPx: this.settings.panThresholdPx,
          naturalPanDirection: this.settings.naturalPanDirection,
          debugLogging: this.settings.debugLogging,
        },
        mode: this.modeState.snapshot(),
        events,
      },
      null,
      2,
    );

    try {
      await window.navigator.clipboard.writeText(payload);
      new Notice(`Surface Tablet: Copied ${events.length} diagnostic events.`);
    } catch (error) {
      console.info("[DEBUG-ST-EXPORT-v1] Copy this diagnostic payload:", payload);
      this.reportError("Could not copy pen diagnostics; wrote them to the console instead", error);
      new Notice("Surface Tablet: Copy failed; diagnostics were written to the console.");
    }
  }

  private debug(message: string, details?: unknown): void {
    if (!this.settings.debugLogging) {
      return;
    }
    if (details === undefined) {
      console.debug(`[Surface Tablet] ${message}`);
    } else {
      console.debug(`[Surface Tablet] ${message}`, details);
    }
  }

  private reportError(message: string, error?: unknown): void {
    console.error(`[Surface Tablet] ${message}`, error);
  }
}
