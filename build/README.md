# App Icons Directory

This directory contains the application icons for different platforms.

## Required Icon Files

Place the following Area49 logo icon files in this directory:

### Windows
- **Area49_logo_A49-2024-3.ico** - Windows application and installer icon
  - Used by electron-builder for the Windows executable and installer

### macOS
- **icon.icns** - macOS application bundle icon
  - Required for macOS .app bundle
  - Should contain multiple resolutions (16x16 up to 1024x1024)

### Linux & General
- **icon.png** - Universal icon file
  - Recommended size: 512x512 or 1024x1024
  - Used for:
    - Linux AppImage and deb packages
    - Application window icon (electron-main.cjs)
    - Web favicon (index.html)

## Icon Generation

If you have the original logo in a high-resolution format (SVG, PNG, etc.):
- Windows .ico: Use tools like ImageMagick or online converters
- macOS .icns: Use `iconutil` on macOS or online converters
- PNG: Export at 1024x1024 for best quality

## Current Configuration

The application is configured to use these icons in:
- `package.json` - electron-builder configuration
- `electron-main.cjs` - window icon configuration
- `index.html` - web favicon
