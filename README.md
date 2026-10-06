# Surface Tablet

Surface Tablet is an Obsidian desktop plugin that makes Canvas usable with a Surface Pen by presenting supported pen interactions to Canvas as mouse interactions.

> [!IMPORTANT]
> Version 0.1 is designed for **Obsidian Desktop on Windows** and is awaiting validation on physical Surface hardware. macOS, Linux, mobile, and non-Surface pens are not supported yet.

## What it does

In Tablet Mode, Surface Tablet changes only the `pointerType` reported for eligible pen events inside Canvas from `pen` to `mouse`. It preserves the event's coordinates, pressure, pointer ID, tilt, and button state. Mouse and touch input are left unchanged.

The plugin provides two mutually exclusive persistent session modes:

- **Mouse Emulation** makes ordinary Canvas taps, card dragging, resizing, deselection, and barrel-button right-clicks behave like mouse input.
- **Pan Mode** uses pen-tip drags to move the Canvas viewport directly.

Enabling Pan Mode switches Mouse Emulation off, and enabling Mouse Emulation switches persistent Pan Mode off. While Mouse Emulation is active, holding the barrel button provides temporary panning without changing either highlighted toolbar action.

Specialized embedded targets—active editors, iframes, PDF views, and Excalidraw views—keep native pen input in v1.

## Controls

When a Canvas is loaded on Windows, its view header contains two actions:

- A pen/pointer action toggles Mouse Emulation.
- A hand action toggles persistent Pan Mode.

Commands are also available:

- `Tablet Mode: Toggle mouse emulation`
- `Tablet Mode: Enable mouse emulation`
- `Tablet Mode: Disable mouse emulation`
- `Tablet Mode: Toggle pan mode`

With Mouse Emulation enabled:

- Pen tip tap/drag uses Canvas mouse behavior.
- A single barrel click keeps native right-click behavior.
- A barrel double-click toggles Mouse Emulation.
- Holding the barrel button and dragging temporarily pans Canvas while Mouse Emulation remains selected.

The first click of a barrel double-click is intentionally not delayed. Its context menu may briefly appear because preserving responsive single-click behavior takes priority.

## Settings

Surface Tablet includes settings for:

- Startup Mouse Emulation state
- Barrel double-click toggle and interval
- Barrel-drag panning and movement threshold
- Canvas view-header controls
- Diagnostic logging

Runtime toggles last only for the current Obsidian session. Each launch starts from the configured default, and Pan Mode always starts disabled.

## Manual installation for development

This repository is private and no release build is published while Surface testing is pending.

1. Run `npm install` and `npm run build`.
2. Create `<vault>/.obsidian/plugins/surface-tablet/`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that directory.
4. Restart Obsidian and enable **Surface Tablet** in Community plugins.

## Development

Requirements: Node.js 24 or newer and npm.

```bash
npm install
npm run dev       # watch and rebuild main.js
npm run verify    # lint, format check, tests, metadata check, and production build
```

The implementation is split into independently testable pieces:

- `WindowPointerPatch` installs and safely restores per-window event accessors.
- `BarrelGestureMachine` classifies single clicks, double-clicks, and drags.
- `PenGestureController` connects raw pointer events to the state machine.
- `CanvasPanController` applies feature-detected Canvas viewport movement.
- `CanvasToolbarController` discovers Canvas views and manages view-header controls.
- `CanvasTargetRegistry` limits transformations to eligible Canvas targets.

## Safety and compatibility

- Overrides are installed separately for the main window and Canvas popout windows.
- Original property descriptors are retained and restored on unload.
- A descriptor is restored only when Surface Tablet's own getter is still installed.
- If another plugin wraps a Surface Tablet getter, it becomes a transparent pass-through after unload instead of overwriting the other plugin.
- If a complete safe patch cannot be installed, that window fails closed and input remains native.
- Focus and visibility restoration refresh Canvas roots and verify that event getters are still installed.
- No telemetry is collected. Debug output stays in the local developer console.

## Hardware validation status

Designed for Windows Surface devices; physical hardware validation is pending. The repository will remain private and versioned below 1.0 until the complete manual test matrix passes on an identified Surface and pen model.

See [TESTING.md](TESTING.md) for the validation checklist.

## License

[MIT](LICENSE)
