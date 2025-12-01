# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-03-xx
### Added
- Initial production release with desktop Electron build and auto-update wiring to GitHub Releases.
- Gemini-powered image generation with control/reference image support, adjustable parameters, and session history.
- Release packaging for Windows (NSIS), macOS (DMG/PKG), and Linux (AppImage/Deb).

### Removed
- Admin dashboard, audit log viewer, and related passphrase flow.

### Notes
- Upload the `dist-electron` artifacts produced by `npx electron-builder -mwl` to the draft GitHub release created by the build and then publish the release to make updates available.
- User data is stored under the user Documents folder (`ImageProvenanceStudio/`), keeping updates non-destructive.
