# AREA49 Nano Banana App

A professional desktop application for AI-powered image generation using Google's Gemini API. Create, manage, and track your AI-generated images with full session history and provenance tracking. Made for AREA49 Team! 
https://www.area49.it/

## Features

### Core Functionality
- **Text-to-Image Generation** - Create images from text prompts using Gemini AI models
- **Control Image** - Guide image structure and composition with reference images
- **Style Transfer** - Apply artistic styles from reference images to generated content
- **Multi-Model Support** - Choose between Flash (free tier) and Pro models
- **Session Management** - Organize generations into sessions with full history tracking

### User Experience
- **Desktop & Web** - Native Electron desktop app with web preview mode
- **Generation History** - View and manage all past generations within each session
- **Session Rename** - Customize session titles for better organization
- **Image Export** - Download generated images to your local filesystem
- **Dark/Light Theme** - Toggle between dark and light UI themes
- **Real-time Status** - Track generation progress and metadata

### Advanced Controls
- **Temperature** - Control creativity and randomness (0.0 - 2.0)
- **Top-P Sampling** - Adjust nucleus sampling for generation diversity
- **Aspect Ratio** - Multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4)
- **Image Size** - Resolution options (256px, 512px, 1K, 2K)
- **Safety Filters** - Content moderation levels (off, low, medium, high)

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 28
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **AI API**: Google Gemini API (@google/genai)
- **Icons**: Lucide React

## Prerequisites

- **Node.js** 18+ and npm
- **Google AI Studio API Key** (required for Pro model, optional for Flash model)
  - Get your key at [Google AI Studio](https://makersuite.google.com/app/apikey)
  - Pro model requires [billing setup](https://ai.google.dev/gemini-api/docs/billing)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd APP-for-NANO
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Running the Application

### Development Mode (Web Preview)

Run the app in your browser with hot-reload:

```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

### Production Desktop Build

Build and package as a native desktop application:

```bash
npm run dist
```

This will:
1. Compile TypeScript
2. Build the React app with Vite
3. Package with Electron Builder

The distributable will be available in the `dist-electron/` directory.

### Installers & Updates

- **Download installers** from the GitHub Releases page for your platform (Windows `.exe`, macOS `.dmg`/`.pkg`, Linux `.AppImage`/`.deb`).
- **First launch** installs the app in your OS-standard location; subsequent launches reuse the installed version.
- **Auto-updates**: the app checks for updates on startup via GitHub Releases and notifies you when a new version is downloading and ready to install.
- **Manual check**: from within the app, you can trigger `window.electron.checkForUpdates()` (exposed through the preload bridge) to immediately re-check the release feed if you need to verify you are on the latest version.

## Usage

### Getting Started

1. **Launch the application** using `npm run dev` or the built executable
2. **Connect API Key** (optional for Flash model, required for Pro model)
   - Click "Connect Google AI Studio" in the top bar
   - Select your API key file from Google AI Studio
3. **Create a new session** or select an existing one from the sidebar

### Generating Images

1. **Enter a prompt** describing what you want to generate
2. **Upload images** (optional):
   - **Control Image**: Guides structure/composition
   - **Reference Image**: Provides style inspiration
3. **Adjust parameters** in the right panel:
   - Select model (Flash or Pro)
   - Adjust temperature, top-p, aspect ratio, size
   - Set safety filter level
4. **Click Generate** to create your image

### Managing Sessions

- **New Session**: Click the "+" button in the sidebar
- **Rename Session**: Click the pencil icon next to session name
- **Delete Session**: Click the trash icon next to session name
- **View History**: Click "History" button to see all generations in current session

### Exporting Images

1. Open the **History** panel
2. Click the **download icon** on any generated image
3. Choose save location in the file dialog

## Admin Dashboard

The desktop build ships with a read-only admin dashboard for operational monitoring.

- **Enable access**: set `VITE_ADMIN_PASSPHRASE` (or `ADMIN_ENABLED=true` with a passphrase) in `.env` next to `electron-main.*`.
- **Open the view**: click **Admin Dashboard** in the top bar. The app prompts for the passphrase and opens a dedicated Electron window with `contextIsolation` enabled.
- **Data sources**: metrics are pulled locally via `os` (CPU, memory, uptime) and session counts from the `sessions` directory. Activity logs reuse the same on-device audit log.
- **Navigation**: use the same button to re-open the dashboard window. Deep-linking `?admin=1` will auto-open the dashboard on launch.

### Admin QA Checklist
- Unlock the dashboard with the configured passphrase (expected failure on wrong input).
- Verify live metrics refresh (CPU, memory, uptime update every 5 seconds or on manual refresh).
- Confirm activity feed matches recent actions in the main app.
- On macOS/Windows/Linux, open and close the admin window and return to the main app without crashes.

## Project Structure

```
APP-for-NANO/
├── components/           # React UI components
│   ├── Sidebar.tsx      # Session list sidebar
│   ├── PromptPanel.tsx  # Text prompt input
│   ├── ImageUploadPanel.tsx  # Image upload UI
│   ├── ParametersPanel.tsx   # Generation settings
│   ├── ResultPanel.tsx       # Output display
│   ├── HistoryPanel.tsx      # Generation history
│   └── SettingsModal.tsx     # App settings
├── services/            # Business logic
│   ├── geminiService.ts      # Gemini API integration
│   ├── newStorageService.ts  # Data persistence
│   └── storageService.ts     # Legacy storage (deprecated)
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main application component
├── index.tsx           # React entry point
├── electron-main.cjs   # Electron main process
├── preload.cjs         # Electron preload script
└── package.json        # Dependencies and scripts
```

## Data Storage

### Desktop Mode
All data is stored locally in your Documents folder:
- **Windows**: `C:\Users\[Username]\Documents\ImageProvenanceStudio\`
- **macOS**: `~/Documents/ImageProvenanceStudio/`
- **Linux**: `~/Documents/ImageProvenanceStudio/`

Directory structure:
```
ImageProvenanceStudio/
├── sessions/      # Session metadata and generation records
├── outputs/       # Generated images
├── controls/      # Control images
└── references/    # Reference images
```

### Web Mode
Data is stored in browser localStorage (limited capacity).

## Available Models

| Model | API Key Required | Cost | Features |
|-------|-----------------|------|----------|
| `gemini-2.5-flash-image` | Optional | Free tier | Fast, good quality |
| `gemini-3-pro-image-preview` | Required | Paid | Highest quality, advanced features |

## Development Scripts

```bash
npm run dev      # Start development server (web mode)
npm run build    # Build for production (web)
npm run dist     # Build and package desktop app
```

## Building for Distribution

The project uses Electron Builder for packaging:

- **Windows**: NSIS installer (`.exe`)
- **macOS**: DMG disk image (`.dmg`)

Build configuration is in `package.json` under the `build` key.

## Release

Maintainers can cut a new release with the following steps:

1. **Bump the version** in `package.json` to the new release number and document the changes in `CHANGELOG.md`.
2. **Build the renderer**: `npm run build`.
3. **Package installers** for all targets: `npx electron-builder -mwl`. Artifacts are written to `dist-electron/` and a draft GitHub release is created.
4. **Upload assets to the draft** created by Electron Builder, then publish the release to make auto-updates available to clients.
5. **Smoke-test the packaged app** on each platform: launch, confirm update checks run on startup, and run `window.electron.checkForUpdates()` for a manual verification if needed.

## Troubleshooting

### API Key Issues
- Ensure you're using a valid API key from Google AI Studio
- Pro model requires billing to be enabled on your Google Cloud project
- Check the console for detailed error messages

### Desktop Build Issues
- On Windows, code signing is disabled by default
- Ensure all dependencies are installed: `npm install`
- Clear build cache: `rm -rf dist dist-electron node_modules && npm install`

### Web Mode Limitations
- Limited storage capacity (localStorage)
- No native file system access for exports
- Use desktop mode for full features

## License

MIT

## Contributing

This project was developed with AI assistance. Feel free to submit issues and pull requests.

## Links

- [Google AI Studio](https://makersuite.google.com/app/apikey) - Get your API key
- [Gemini API Documentation](https://ai.google.dev/docs) - API reference
- [Electron Documentation](https://www.electronjs.org/docs) - Desktop framework

---

Built with [React](https://react.dev/), [Electron](https://www.electronjs.org/), and [Google Gemini](https://ai.google.dev/)
