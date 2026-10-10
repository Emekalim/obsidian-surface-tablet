import { FileView, getIconIds, setIcon, type App } from "obsidian";
import type { CanvasViewport } from "./canvas-pan-controller";
import type { CanvasTargetRegistry } from "./canvas-target-registry";
import type { SurfaceTabletModeSnapshot } from "./mode-state";

interface CanvasControls {
  tabletButton: HTMLElement;
  panButton: HTMLElement;
}

export interface CanvasToolbarDependencies {
  supported: boolean;
  shouldShowControls: () => boolean;
  getModeState: () => Readonly<SurfaceTabletModeSnapshot>;
  toggleTabletMode: () => void;
  togglePanMode: () => void;
}

/** Discovers public Canvas FileViews, tracks their roots, and adds native view-header actions. */
export class CanvasToolbarController {
  private readonly controls = new Map<FileView, CanvasControls>();
  private readonly availableIcons = new Set(getIconIds());

  constructor(
    private readonly app: App,
    private readonly canvasTargets: CanvasTargetRegistry,
    private readonly dependencies: CanvasToolbarDependencies,
  ) {}

  sync(): void {
    const views = this.findCanvasViews();
    this.canvasTargets.replaceTargets(
      [...views].map((view) => ({
        root: view.contentEl,
        getViewport: () => getCanvasViewport(view),
      })),
    );

    for (const [view, controls] of this.controls) {
      if (!views.has(view) || !this.shouldRenderControls()) {
        controls.tabletButton.remove();
        controls.panButton.remove();
        this.controls.delete(view);
      }
    }

    if (this.shouldRenderControls()) {
      for (const view of views) {
        if (!this.controls.has(view)) {
          this.controls.set(view, this.addControls(view));
        }
      }
    }

    this.refresh();
  }

  refresh(): void {
    const state = this.dependencies.getModeState();
    for (const controls of this.controls.values()) {
      const tabletTitle = state.tabletModeEnabled
        ? "Surface Tablet: mouse emulation on"
        : "Surface Tablet: native pen mode";
      const tabletIcon = state.tabletModeEnabled
        ? this.icon("mouse-pointer-2", "pointer")
        : this.icon("pen-tool", "pen");

      setIcon(controls.tabletButton, tabletIcon);
      controls.tabletButton.setAttribute("aria-label", tabletTitle);
      controls.tabletButton.setAttribute("aria-pressed", String(state.tabletModeEnabled));
      controls.tabletButton.setAttribute("title", tabletTitle);
      controls.tabletButton.classList.toggle("is-active", state.tabletModeEnabled);

      const panTitle = state.panModeEnabled
        ? "Surface Tablet: pan mode on"
        : "Surface Tablet: pan mode off";
      setIcon(controls.panButton, this.icon("hand", "move"));
      controls.panButton.setAttribute("aria-label", panTitle);
      controls.panButton.setAttribute("aria-pressed", String(state.panModeEnabled));
      controls.panButton.setAttribute("title", panTitle);
      controls.panButton.classList.toggle("is-active", state.panModeEnabled);
    }
  }

  destroy(): void {
    for (const controls of this.controls.values()) {
      controls.tabletButton.remove();
      controls.panButton.remove();
    }
    this.controls.clear();
    this.canvasTargets.clear();
  }

  private findCanvasViews(): Set<FileView> {
    const views = new Set<FileView>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof FileView && view.file?.extension === "canvas") {
        views.add(view);
      }
    });
    return views;
  }

  private addControls(view: FileView): CanvasControls {
    const tabletButton = view.addAction(
      this.icon("pen-tool", "pen"),
      "Surface Tablet: toggle mouse emulation",
      this.dependencies.toggleTabletMode,
    );
    tabletButton.classList.add("surface-tablet-control", "surface-tablet-mode-control");

    const panButton = view.addAction(
      this.icon("hand", "move"),
      "Surface Tablet: toggle pan mode",
      this.dependencies.togglePanMode,
    );
    panButton.classList.add("surface-tablet-control", "surface-tablet-pan-control");

    return { tabletButton, panButton };
  }

  private shouldRenderControls(): boolean {
    return this.dependencies.supported && this.dependencies.shouldShowControls();
  }

  private icon(preferred: string, fallback: string): string {
    return this.availableIcons.has(preferred) ? preferred : fallback;
  }
}

function getCanvasViewport(view: FileView): CanvasViewport | null {
  const canvas = (view as FileView & { canvas?: Partial<CanvasViewport> }).canvas;
  if (
    !canvas ||
    typeof canvas.tx !== "number" ||
    typeof canvas.ty !== "number" ||
    typeof canvas.markViewportChanged !== "function"
  ) {
    return null;
  }
  return canvas as CanvasViewport;
}
