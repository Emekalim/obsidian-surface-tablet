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
- [ ] Double barrel-click toggles Mouse Emulation.
- [ ] Double barrel-click again restores Native Pen Mode.
- [ ] Notices report command and barrel-gesture state changes.
- [ ] View-header actions remain synchronized across multiple Canvases and popout windows.

## Temporary panning

- [ ] In Mouse Emulation mode, hold the barrel button and drag blank Canvas.
- [ ] Canvas pans using native right-drag behavior.
- [ ] No context menu opens after the pan.
- [ ] No Canvas card moves during the pan.
- [ ] Releasing or cancelling the pointer ends panning.
- [ ] In Native Pen Mode, barrel events remain unmodified.

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
- [ ] Enable debug logging only while collecting diagnostics; confirm pointer moves are not continuously logged.
