export interface SurfaceTabletModeSnapshot {
  tabletModeEnabled: boolean;
  panModeEnabled: boolean;
}

type ModeListener = (state: Readonly<SurfaceTabletModeSnapshot>) => void;

export class SurfaceTabletModeState {
  private state: SurfaceTabletModeSnapshot;
  private readonly listeners = new Set<ModeListener>();

  constructor(tabletModeEnabled: boolean) {
    this.state = { tabletModeEnabled, panModeEnabled: false };
  }

  snapshot(): Readonly<SurfaceTabletModeSnapshot> {
    return this.state;
  }

  setTabletMode(enabled: boolean): boolean {
    if (this.state.tabletModeEnabled === enabled) {
      return false;
    }
    this.state = { ...this.state, tabletModeEnabled: enabled };
    this.notify();
    return true;
  }

  toggleTabletMode(): boolean {
    this.setTabletMode(!this.state.tabletModeEnabled);
    return this.state.tabletModeEnabled;
  }

  setPanMode(enabled: boolean): boolean {
    if (this.state.panModeEnabled === enabled) {
      return false;
    }
    this.state = { ...this.state, panModeEnabled: enabled };
    this.notify();
    return true;
  }

  togglePanMode(): boolean {
    this.setPanMode(!this.state.panModeEnabled);
    return this.state.panModeEnabled;
  }

  subscribe(listener: ModeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
