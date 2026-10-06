import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import type { SurfaceTabletSettings } from "./settings";

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

    containerEl.createEl("h2", { text: "Surface Tablet" });
    containerEl.createEl("p", {
      text: this.host.supportedPlatform
        ? "Surface Pen controls for Obsidian Canvas on Windows. Runtime mode changes last for the current session only."
        : "Surface Tablet v1 supports Obsidian Desktop on Windows. Input controls remain inactive on this operating system.",
    });

    new Setting(containerEl)
      .setName("Enable Tablet Mode automatically")
      .setDesc("Start each Obsidian session with Canvas pen-to-mouse emulation enabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.enableTabletModeOnStartup).onChange(async (value) => {
          this.host.settings.enableTabletModeOnStartup = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Double-click pen side button")
      .setDesc("Double-click the Surface Pen barrel button in Canvas to toggle mouse emulation.")
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.enableBarrelDoubleClick).onChange(async (value) => {
          this.host.settings.enableBarrelDoubleClick = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Double-click interval")
      .setDesc("Maximum time between barrel clicks.")
      .addSlider((slider) =>
        slider
          .setLimits(200, 600, 25)
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
        "In Mouse Emulation mode, hold the barrel button and drag for temporary Canvas panning.",
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
      .setDesc("Show mouse-emulation and Pan Mode actions in each Canvas view header.")
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.showCanvasControls).onChange(async (value) => {
          this.host.settings.showCanvasControls = value;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc(
        "Capture raw Canvas pointer-state changes and log them to the developer console. Use the Clear and Copy pen diagnostics commands to collect a test trace.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.debugLogging).onChange(async (value) => {
          this.host.settings.debugLogging = value;
          await this.host.saveSettings();
        }),
      );
  }
}
