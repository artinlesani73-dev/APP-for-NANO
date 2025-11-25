# Admin Dashboard Guide

This guide covers how to enable, unlock, and operate the read-only admin dashboard in the AREA49 Nano Banana app. Use it to monitor system health, review audit logs, and confirm safe window handling across platforms.

## Prerequisites
- Desktop/Electron build of the app (dashboard is not exposed in plain web preview).
- A strong passphrase set via `VITE_ADMIN_PASSPHRASE` in a `.env` file next to `electron-main.js`/`electron-main.cjs`.
- Optional feature flag: `ADMIN_ENABLED=true` if you want an explicit toggle for admin window creation in addition to the passphrase check.
- Optional shared log destination: `LOG_SHARE_PATH` or `VITE_LOG_SHARE_PATH` (e.g., `\\192.168.1.2\area49`). The app writes `logs.json` there when reachable and falls back to the local `ImageProvenanceStudio/logs.json` under the user Documents folder if the share is unavailable.

## Setup
1. Create or update `.env` in the project root:
   ```env
   VITE_ADMIN_PASSPHRASE=<your-strong-passphrase>
   ADMIN_ENABLED=true            # optional
   LOG_SHARE_PATH=\\192.168.1.2\area49  # optional shared log directory
   ```
2. Restart the Electron app after changing environment variables so the main process picks them up.
3. If using a network share, ensure the user account running the app has write access and the path exists.

## Launch and Unlock
1. Start the desktop app (`npm run dev` with Electron target or a packaged build).
2. Open the dashboard by clicking **Admin Dashboard** in the top bar. You can also deep-link with `?admin=1` to auto-open on launch.
3. Enter the configured passphrase. Incorrect input keeps the window closed; correct input opens a separate, isolated admin window.

## What You See
- **Live metrics**: CPU, memory, and uptime from the local OS plus active session count. Values refresh automatically every 5 seconds; use the UI refresh control (if present) for an immediate pull.
- **Alerts**: Banners surface high resource usage or notable events returned by the metrics service.
- **Activity feed**: Recent on-device audit entries (session opens, generations, exports) streamed from `logs.json`.

## Log Storage and Sharing
- Default location: `ImageProvenanceStudio/logs.json` in the user Documents folder (platform-standard path).
- Shared directory: when `LOG_SHARE_PATH`/`VITE_LOG_SHARE_PATH` points to a reachable folder (e.g., `\\192.168.1.2\area49`), the app writes `logs.json` there for centralized review. If the share is offline or access is denied, logging automatically falls back to the local default without interrupting the dashboard.
- The dashboard is read-only: it visualizes the audit log and metrics; it does not modify data or pull events from other machines unless they also log to the same shared directory.

## Navigation and Lifecycle
- Reopen the dashboard any time via the top-bar button; closing it leaves the main app running.
- Context isolation is enforced in the admin window; only the approved preload bridges expose metrics and logs.
- Test on macOS, Windows, and Linux to confirm the window opens, focuses, and closes cleanly.

## Security Tips
- Keep the admin passphrase private and rotate it periodically.
- Restrict permissions on any shared log directory to trusted admins only.
- Avoid storing the passphrase in plaintext on shared machines; prefer per-user environment configuration.

## Troubleshooting
- **Dashboard will not open**: Confirm `VITE_ADMIN_PASSPHRASE` is set and restart the app. If you use `ADMIN_ENABLED`, ensure it is `true`.
- **Metrics are empty**: Verify the preload bridge is active and that the app can read from the user Documents folder where sessions and logs live.
- **Shared log path not used**: Check the network path spelling, ensure the share is online, and verify write permissions. The app falls back silently to the local path when the share is unavailable.
