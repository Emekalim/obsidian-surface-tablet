# Surface Tablet manual test matrix

Record the Surface model, pen model, Windows version, Obsidian version, and plugin commit before testing.

## Native Pen Mode

- [ ] Pen reports `pointerType = "pen"`.
- [ ] Existing pen functionality outside Canvas remains native.
- [ ] Mouse input remains unchanged.
- [ ] Touch input remains unchanged.

## Mouse Emulation

- [ ] Tap a Canvas card with the pen.
- [ ] Tap blank Canvas to deselect.
- [ ] Drag a Canvas card.
- [ ] Resize a Canvas card.
- [ ] Barrel-click a Canvas card to open its context menu.
- [ ] Barrel-click blank Canvas to open its context menu.
- [ ] Verify mouse and touch input still work normally.
- [ ] Verify active Markdown editors, PDFs, Excalidraw, and web embeds keep native pen input.

## Mode toggles

- [ ] Toggle Mouse Emulation through the Canvas view-header action.
- [ ] Toggle Mouse Emulation through the command palette.
- [ ] Hold the barrel button and tap Canvas twice within 600 ms to enable Mouse Emulation.
- [ ] Verify the double-tap interval can be adjusted from 250 to 1000 ms and defaults to 600 ms.
- [ ] Repeat the contact double-tap to restore Native Pen Mode.
- [ ] The first tap may open its context menu; the second tap suppresses its context menu and toggles the mode.
- [ ] Notices report command and barrel-gesture state changes.
- [ ] View-header actions remain synchronized across multiple Canvases and popout windows.
- [ ] Enabling persistent Pan Mode switches Mouse Emulation off.
- [ ] Enabling Mouse Emulation switches persistent Pan Mode off.

## Temporary panning

- [ ] In Mouse Emulation mode, hold the barrel button before tip contact, touch Canvas, and drag.
- [ ] Repeat the same temporary barrel drag in Native Pen Mode.
- [ ] Canvas pans through the temporary direct-pan path.
- [ ] Mouse Emulation remains visually selected while temporary panning, and the Hand action remains off.
- [ ] No context menu opens after the pan.
- [ ] No Canvas card moves during the pan.
- [ ] Releasing or cancelling the pointer ends panning.
- [ ] A Native Pen barrel tap without a drag still opens its context menu.
- [ ] With Natural pan direction enabled, dragging left pans the view right.
- [ ] With Natural pan direction disabled, dragging left pans the view left.

## Persistent Pan Mode

- [ ] Enable the Hand action while Mouse Emulation is off.
- [ ] Pen-tip drag anywhere on ordinary Canvas surfaces pans the Canvas.
- [ ] Disable the Hand action.
- [ ] Normal selection and dragging resume.
- [ ] Repeat while Mouse Emulation is on.
- [ ] Mouse and touch behavior remain unchanged while Pan Mode is enabled.

## Lifecycle and conflicts

- [ ] Disable the plugin.
- [ ] `PointerEvent.prototype` descriptors behave exactly as before.
- [ ] View-header actions disappear.
- [ ] Event listeners are removed.
- [ ] Re-enable the plugin and confirm controls are not duplicated.
- [ ] Open and close a Canvas popout and confirm its descriptors are installed and restored independently.
- [ ] Minimize and restore Obsidian, then verify card dragging and resizing still work.
- [ ] If restored pen events report raw `isPrimary = false`, verify Mouse Emulation reports `isPrimary = true` only inside Canvas.
- [ ] Minimize and restore Obsidian with Pan Mode selected, then verify pen-tip panning still works.
- [ ] Enable debug logging only while collecting diagnostics; confirm pointer moves are not continuously logged.
