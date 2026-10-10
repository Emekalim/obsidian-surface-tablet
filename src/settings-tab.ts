import { PluginSettingTab, type App, type Plugin, type SettingDefinitionItem } from "obsidian";
import {
  DOUBLE_TAP_INTERVAL_MAX_MS,
  DOUBLE_TAP_INTERVAL_MIN_MS,
  DOUBLE_TAP_INTERVAL_STEP_MS,
  type SurfaceTabletSettings,
} from "./settings";

export interface SurfaceTabletSettingsHost {
  settings: SurfaceTabletSettings;
  supportedPlatform: boolean;
  saveSettings: () => Promise<void>;
}

type SettingKey = keyof SurfaceTabletSettings;

export class SurfaceTabletSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly host: SurfaceTabletSettingsHost & Plugin,
  ) {
    super(app, host);
  }

  override getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: this.host.supportedPlatform ? "Surface Pen controls" : "Unsupported platform",
        desc: this.host.supportedPlatform
          ? "Surface Pen controls for Obsidian Canvas on Windows. Runtime mode changes last for the current session only."
          : "Surface Tablet 1.0 supports Obsidian Desktop on Windows. Input controls remain inactive on this operating system.",
        searchable: false,
      },
      {
        name: "Enable tablet mode automatically",
        desc: "Start each Obsidian session with Canvas pen-to-mouse emulation enabled.",
        control: { type: "toggle", key: "enableTabletModeOnStartup" },
      },
      {
        name: "Double-tap with pen side button",
        desc: "Hold the Surface Pen barrel button and tap Canvas twice to toggle mouse emulation. Hover-only button presses are not exposed to Obsidian on the tested hardware.",
        control: { type: "toggle", key: "enableBarrelDoubleClick" },
      },
      {
        name: "Double-tap interval",
        desc: "Maximum time from the first barrel-assisted tap ending to the second starting. The tested default is 600 ms.",
        control: {
          type: "slider",
          key: "doubleClickIntervalMs",
          min: DOUBLE_TAP_INTERVAL_MIN_MS,
          max: DOUBLE_TAP_INTERVAL_MAX_MS,
          step: DOUBLE_TAP_INTERVAL_STEP_MS,
          displayFormat: (value) => `${value} ms`,
        },
      },
      {
        name: "Hold pen side button to pan",
        desc: "In native pen or mouse emulation mode, hold the barrel button before touching Canvas, then drag to pan temporarily.",
        control: { type: "toggle", key: "enableBarrelPan" },
      },
      {
        name: "Pan movement threshold",
        desc: "Movement required before a barrel gesture is classified as a pan, in CSS pixels.",
        control: {
          type: "slider",
          key: "panThresholdPx",
          min: 2,
          max: 20,
          step: 1,
          displayFormat: (value) => `${value} px`,
        },
      },
      {
        name: "Natural pan direction",
        desc: "Move the Canvas opposite the pen drag, like swiping a physical surface. Turn this off to move the Canvas in the same direction as the pen.",
        control: { type: "toggle", key: "naturalPanDirection" },
      },
      {
        name: "Show Canvas controls",
        desc: "Show mouse-emulation and pan mode actions in each Canvas view header.",
        control: { type: "toggle", key: "showCanvasControls" },
      },
      {
        name: "Debug logging",
        desc: "Capture raw Canvas pointer-state changes and log them to the developer console. Use the clear and copy pen diagnostics commands to collect a test trace.",
        control: { type: "toggle", key: "debugLogging" },
      },
    ];
  }

  override getControlValue(key: string): unknown {
    return this.host.settings[key as SettingKey];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    this.host.settings = { ...this.host.settings, [key as SettingKey]: value };
    await this.host.saveSettings();
  }
}
