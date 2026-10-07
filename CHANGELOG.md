# Changelog

## 0.5.0

- Finalize Surface-tested barrel single-tap, contact double-tap, and temporary-pan gestures.
- Dismiss the exact first Canvas context menu after a valid barrel double-tap while preserving ordinary right-clicks.
- Restore card dragging and resizing after minimize/restore by normalizing non-primary restored pen input inside Canvas.
- Keep native primary-pointer state for mouse, touch, Native Pen Mode, and pen input outside Canvas.
- Expand the double-tap interval setting to 250–1000 ms while keeping the tested 600 ms default.
- Retain raw and reported primary-pointer values in opt-in diagnostics and remove temporary lifecycle probes.

## 0.4.8

- Treat Canvas-scoped Surface Pen input as the primary pointer while Mouse Mode is enabled.
- Work around Windows/Electron reporting restored pen sessions as non-primary after minimizing.
- Preserve the native `isPrimary` value for mouse, touch, Native Pen Mode, and pen input outside Canvas.
- Export both raw and reported primary-pointer state for hardware verification.

## 0.4.7

- Add diagnostic-only lifecycle events for window focus, blur, and document visibility.
- Record every mode-change request with its toolbar, command, or pen source.
- Export pointer-patch health, window identity, runtime counts, and Canvas toolbar counts.
- Preserve existing mouse emulation, panning, and barrel gesture behavior unchanged.

## 0.4.6

- Retain Canvas's exact asynchronously displayed context-menu instance for 150 ms.
- Dismiss the retained first menu only after a valid barrel double-click completes.
- Remove the temporary menu API probes and DOM snapshot diagnostics from 0.4.5.
- Add regression coverage for Canvas's observed delayed menu creation.

## 0.4.5

- Add diagnostic probes for both public Obsidian menu-show methods.
- Record timing, event identity, coordinate distance, and document matching for menu calls.
- Record visible menu-related DOM candidates immediately and 75 ms after the first barrel menu.
- Extend the diagnostic watch window to detect asynchronously displayed Canvas menus.

## 0.4.4

- Capture Canvas menus displayed through `Menu.showAtPosition()` during the first barrel click.
- Match positioned menus by the active event's document and screen coordinates.
- Preserve original positioned-menu behavior and restore its wrapper defensively on unload.

## 0.4.3

- Capture the exact Canvas menu instance when Obsidian displays it for the first barrel click.
- Preserve Canvas's original menu-show behavior before retaining the instance.
- Restore the menu-show wrapper defensively without overwriting later plugin changes.
- Remove the unsuccessful `Menu.forEvent()` menu-retention path.

## 0.4.2

- Let Canvas create and display its normal context menu before retaining the exact menu instance.
- Keep double-click context-menu suppression in the early capture phase.
- Add regression coverage for Canvas-before-plugin context-menu ordering.

## 0.4.1

- Retain the exact Obsidian Canvas context menu opened by the first barrel tap.
- Dismiss that menu through Obsidian's `Menu.hide()` lifecycle when the second tap toggles mode.
- Add exported diagnostic flags for menu capture and dismissal attempts.

## 0.4.0

- Enabled temporary barrel-drag panning in Native Pen mode as well as Mouse Emulation mode.
- Set the default contact double-tap interval to 600 ms based on Surface hardware traces.
- Documented the hardware-validated toggle gesture: hold the barrel button and tap Canvas twice.
- Preserved single barrel-assisted tap right-click behavior and second-tap context-menu suppression.
- Added regression coverage replaying distinct Surface pen pointer IDs and observed timing.

## 0.3.1

- Added an opt-in raw Canvas pointer-event diagnostic buffer for Surface hardware investigation.
- Added commands to clear and copy structured pen diagnostics.
- Included non-pen Canvas pointer classifications in traces to detect OS or Electron event conversion.
- Kept diagnostic logging disabled by default and limited the buffer to 500 state-changing events.

## 0.3.0

- Added configurable pan direction, with natural swipe-style panning enabled by default.
- Detect barrel-button presses from `buttons` state transitions during pen hover instead of requiring a barrel `pointerdown` event.
- Carry a barrel hold recognized before tip contact into temporary Canvas panning.
- Start temporary panning when the barrel button is pressed after tip contact.
- Prevent completed pans from being classified as barrel clicks.
- Keep gesture tracking Canvas-scoped while pointer events are retargeted during contact.

## 0.2.0

- Added direct Canvas viewport panning for temporary barrel drag and persistent Pan Mode.
- Made persistent Pan Mode and Mouse Emulation mutually exclusive.
- Kept Mouse Emulation visually active during temporary barrel panning.
- Preserved mouse emulation across retargeted drag events.
- Added focus and visibility recovery for minimized or restored windows.
- Added safe getter health checks and reinstallation after window lifecycle changes.
- Improved barrel double-click tolerance for normal pen jitter.

## 0.1.0

- Initial private development build.
- Added Canvas-scoped Surface Pen mouse emulation.
- Added independent persistent Pan Mode using middle-button semantics.
- Added barrel single-click, double-click, and drag gesture classification.
- Added Canvas view-header controls, commands, settings, Notices, and opt-in diagnostics.
- Added multi-window lifecycle management and defensive descriptor restoration.
