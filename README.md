# AREA49 Nano Banana App

An interactive canvas for multimodal creation with Google's Gemini API. Generate images, draft text that references canvas context images, and curate sessions on a pixel-grid workspace with pan/zoom, whiteboards, and editable text blocks.

## Key Features

- **Multimodal prompts**: Selected canvas images are always sent as inline references for both text and image generations.
- **Canvas workspace**: Pan/zoom, drag & drop uploads, and a consistent dotted background that stays the same size at any zoom level.
- **Context menu**: Right-click to upload an image, add freeform text, or drop a blank whiteboard.
- **Editable text blocks**: Double-click text to open a mini toolbar for size/bold/italic tweaks and direct content edits; text boxes resize freely.
- **Whiteboards & images**: Move, select, and resize items; images keep their aspect ratio while boards and text are flexible.
- **Sessions & history**: Organize work into sessions; only image generations are stored in history while text outputs remain on the canvas.
- **Theme & desktop**: Dark/light themes with Vite-powered React front end and Electron desktop packaging.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Desktop**: Electron 28 (optional)
- **Build Tooling**: Vite 5, PostCSS, ESLint
- **AI API**: Google Gemini (@google/genai)
- **Icons**: Lucide React

## Prerequisites

- **Node.js 18+** and npm
- **Google AI Studio API Key** for Gemini (required for Pro models)

## Installation

```bash
git clone <repository-url>
cd APP-for-NANO
npm install
```

## Running the Application

### Web Preview (Development)
```bash
npm run dev
```
Open http://localhost:5173 and use the app in the browser.

### Production Desktop Build
```bash
npm run dist
```
Packages the Electron desktop app. Distributables are emitted under `dist-electron/`.

## Usage Guide

### Canvas Basics
- **Pan/Zoom**: Scroll to zoom and drag the background to pan; the dotted pattern stays a constant size.
- **Context Menu**: Right-click to upload an image, add a text block, or insert a whiteboard.
- **Selection & Resizing**: Click to select; drag the corner handle to resize. Images keep aspect ratio, while text/whiteboards resize freely.
- **Text Editing**: Double-click any text block to open the mini toolbar (font size, bold, italic) and edit content inline.

### Generating Content
1. Enter a prompt and optionally select canvas images to serve as context.
2. Choose Gemini model and parameters.
3. Click **Generate Image** or **Generate Text**.
4. Results land on the canvas; image generations are added to session history, while text results stay on the board only.
5. Display-name header: requests include the user’s chosen display name in `X-User-Name`.

### Sessions & Export
- Create, rename, or delete sessions from the sidebar.
- History tracks image generations with timestamps and references.
- Export a session as JSON from the sidebar controls.

## Project Structure
```
APP-for-NANO/
├── components/            # React UI components (canvas, panels, modals)
├── services/              # API and storage services
├── docs/                  # Additional documentation
├── types.ts               # Shared TypeScript types
├── App.tsx / index.tsx    # App entry points
├── electron-main.* / preload.* # Electron main & preload
└── package.json           # Scripts and dependencies
```

## Development Scripts
```bash
npm run dev      # Start development server
npm run build    # Production web build
npm run dist     # Package Electron app
```

## Notes
- Image history persists per session; text generations are intentionally excluded from history.
- Context images are attached to both text and image requests to keep responses aligned with the canvas.
