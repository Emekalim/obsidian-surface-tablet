# Surface Tablet

Surface Tablet is an Obsidian desktop plugin that makes Canvas usable with a Surface Pen by presenting supported pen interactions to Canvas as mouse interactions.

> [!IMPORTANT]
> Version 0.3 is designed for **Obsidian Desktop on Windows** and is being validated with a Microsoft Surface Pen. macOS, Linux, mobile, and non-Surface pens are not supported yet.

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
- Holding the barrel button before or during tip contact and dragging temporarily pans Canvas while Mouse Emulation remains selected.

The first click of a barrel double-click is intentionally not delayed. Its context menu may briefly appear because preserving responsive single-click behavior takes priority.

## Settings

Surface Tablet includes settings for:

- Startup Mouse Emulation state
- Barrel double-click toggle and interval
- Barrel-drag panning and movement threshold
- Natural (opposite-direction) or direct (same-direction) panning
- Canvas view-header controls
- Diagnostic logging

Runtime toggles last only for the current Obsidian session. Each launch starts from the configured default, and Pan Mode always starts disabled.

## Manual installation for development

This repository is private and no release build is published while Surface testing is pending.

1. Run `npm install` and `npm run build`.
2. Create `<vault>/.obsidian/plugins/surface-tablet/`.
3. Copy `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` into that directory.
4. Restart Obsidian and enable **Surface Tablet** in Community plugins.

The ignored `dist/` directory is the complete installable plugin output. Files under `src/` are development sources and are not copied into Obsidian.

## Development

Requirements: Node.js 24 or newer and npm.

```bash
npm install
npm run dev       # watch and rebuild dist/main.js
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

## Capturing Surface Pen diagnostics

Diagnostics are local and disabled by default. To capture a hardware trace:

1. Enable **Debug logging** in Surface Tablet settings.
2. Run `Tablet Mode: Clear pen diagnostics` from the command palette.
3. Perform one test gesture on blank Canvas.
4. Run `Tablet Mode: Copy pen diagnostics`.
5. Paste the copied JSON into the bug report and state whether the gesture worked.

Capture these gestures separately so their event streams remain easy to compare:

- One barrel-button press and release while hovering, without touching the screen.
- Two barrel-button presses while hovering.
- Hold the barrel button while hovering, touch blank Canvas, then drag.
- Touch blank Canvas first, press the barrel button, then drag.

The buffer records changed pointer states inside Canvas, including pen, mouse, and touch classifications. It is capped at 500 events and omits note text. Tagged `[DEBUG-ST-INPUT-v1]` entries are also written to DevTools while logging is enabled.

## Hardware validation status

Designed for Windows Surface devices and currently tested with a Microsoft Surface Pen. The repository will remain private and versioned below 1.0 until the complete manual test matrix passes on an identified Surface and pen model.

See [TESTING.md](TESTING.md) for the validation checklist.

## License

[MIT](LICENSE)
