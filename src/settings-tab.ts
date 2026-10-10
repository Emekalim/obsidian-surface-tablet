import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
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

export class SurfaceTabletSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly host: SurfaceTabletSettingsHost & Plugin,
  ) {
    super(app, host);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: this.host.supportedPlatform
        ? "Surface Pen controls for Obsidian Canvas on Windows. Runtime mode changes last for the current session only."
        : "Surface Tablet 1.0 supports Obsidian Desktop on Windows. Input controls remain inactive on this operating system.",
    });

    new Setting(containerEl)
      .setName("Enable tablet mode automatically")
      .setDesc("Start each Obsidian session with Canvas pen-to-mouse emulation enabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.enableTabletModeOnStartup).onChange(async (value) => {
          this.host.settings.enableTabletModeOnStartup = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Double-tap with pen side button")
      .setDesc(
        "Hold the Surface Pen barrel button and tap Canvas twice to toggle mouse emulation. Hover-only button presses are not exposed to Obsidian on the tested hardware.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.enableBarrelDoubleClick).onChange(async (value) => {
          this.host.settings.enableBarrelDoubleClick = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Double-tap interval")
      .setDesc(
        "Maximum time from the first barrel-assisted tap ending to the second starting. The tested default is 600 ms.",
      )
      .addSlider((slider) =>
        slider
          .setLimits(
            DOUBLE_TAP_INTERVAL_MIN_MS,
            DOUBLE_TAP_INTERVAL_MAX_MS,
            DOUBLE_TAP_INTERVAL_STEP_MS,
          )
          .setValue(this.host.settings.doubleClickIntervalMs)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.doubleClickIntervalMs = value;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Hold pen side button to pan")
      .setDesc(
        "In native pen or mouse emulation mode, hold the barrel button before touching Canvas, then drag to pan temporarily.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.enableBarrelPan).onChange(async (value) => {
          this.host.settings.enableBarrelPan = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Pan movement threshold")
      .setDesc("Movement required before a barrel gesture is classified as a pan, in CSS pixels.")
      .addSlider((slider) =>
        slider
          .setLimits(2, 20, 1)
          .setValue(this.host.settings.panThresholdPx)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.panThresholdPx = value;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Natural pan direction")
      .setDesc(
        "Move the Canvas opposite the pen drag, like swiping a physical surface. Turn this off to move the Canvas in the same direction as the pen.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.naturalPanDirection).onChange(async (value) => {
          this.host.settings.naturalPanDirection = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Show Canvas controls")
      .setDesc("Show mouse-emulation and pan mode actions in each Canvas view header.")
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.showCanvasControls).onChange(async (value) => {
          this.host.settings.showCanvasControls = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc(
        "Capture raw Canvas pointer-state changes and log them to the developer console. Use the clear and copy pen diagnostics commands to collect a test trace.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.debugLogging).onChange(async (value) => {
          this.host.settings.debugLogging = value;
          await this.host.saveSettings();
        }),
      );
  }
}
