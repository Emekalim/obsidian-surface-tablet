# Changelog

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
