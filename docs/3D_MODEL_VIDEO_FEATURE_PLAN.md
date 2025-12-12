# 3D Model Upload & Video Generation Feature Plan

## Overview

This document outlines the implementation plan for two major features:

1. **3D Model Upload & Screenshot Capture** - Upload IFC, GLB, and OBJ files to the canvas with an interactive edit mode for viewing models from different angles and capturing screenshots
2. **Video Generation** - Generate AI videos using prompts and reference images (same workflow as image generation)

---

## Feature 1: 3D Model Upload & Screenshot Capture

### 1.1 Core Concept

Users can upload 3D model files (IFC, GLB, OBJ) which appear on the canvas as interactive containers. In **Edit Mode**, users can orbit, pan, and zoom around the model to view it from any angle, then capture screenshots that are automatically added to the canvas as regular images.

### 1.2 User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. UPLOAD                                                       │
│     User uploads .ifc, .glb, or .obj file via drag-drop or      │
│     file picker                                                  │
│                              ↓                                   │
│  2. CANVAS PREVIEW                                               │
│     Model appears on canvas as a container with 3D preview       │
│     thumbnail and "3D" badge indicator                           │
│                              ↓                                   │
│  3. ENTER EDIT MODE                                              │
│     Double-click the 3D container to open the 3D Viewer Modal   │
│                              ↓                                   │
│  4. INTERACT WITH MODEL                                          │
│     - Orbit: Click + drag to rotate view around model           │
│     - Pan: Shift + drag to move camera position                 │
│     - Zoom: Scroll wheel to zoom in/out                         │
│     - Presets: Quick buttons for Front/Back/Left/Right/Top/etc  │
│                              ↓                                   │
│  5. CAPTURE SCREENSHOT                                           │
│     Click "Take Screenshot" button at any desired view angle    │
│                              ↓                                   │
│  6. AUTO-ADD TO CANVAS                                           │
│     Screenshot is automatically saved and added to canvas as    │
│     a regular image (can be used for AI generation, tagging)    │
│                              ↓                                   │
│  7. REPEAT OR EXIT                                               │
│     Take more screenshots from different angles or close modal  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Supported File Formats

| Format | Extension | Description | Use Case |
|--------|-----------|-------------|----------|
| **GLB/GLTF** | `.glb`, `.gltf` | GL Transmission Format | General 3D models, game assets, web 3D |
| **OBJ** | `.obj` | Wavefront OBJ | Simple 3D models, CAD exports |
| **IFC** | `.ifc` | Industry Foundation Classes | Architectural/BIM models |

### 1.4 Implementation Components

#### A. Type Definitions

**File: `types.ts`**

```typescript
// 3D Model canvas item
interface Canvas3DModel {
  id: string;
  type: '3d-model';
  modelType: 'ifc' | 'glb' | 'obj';

  // File storage
  modelPath?: string;           // Electron: path to model file on disk
  modelDataUri?: string;        // Web: base64 encoded model (GLB/OBJ only)
  fileName: string;
  fileSize: number;

  // Canvas display
  thumbnailUri?: string;        // Preview thumbnail for canvas
  thumbnailPath?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;        // Original thumbnail width (for aspect ratio)
  originalHeight: number;       // Original thumbnail height (for aspect ratio)
  aspectRatio: number;          // Locked aspect ratio (width / height)
  selected: boolean;

  // 3D metadata
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  vertexCount?: number;
  faceCount?: number;

  // Appearance settings
  modelColor?: string;          // Hex color to apply to entire model (e.g., '#808080')
  useOriginalColors: boolean;   // If true, use model's original materials/colors

  // Saved camera state (restore last view)
  savedCameraPosition?: { x: number; y: number; z: number };
  savedCameraTarget?: { x: number; y: number; z: number };
}

// Screenshot from 3D model (extends regular CanvasImage)
interface CanvasImage {
  // ... existing fields ...
  source?: 'upload' | 'generation' | '3d-screenshot';
  sourceModelId?: string;  // Link to parent 3D model if from screenshot
}

// Union type for all canvas items
type CanvasItem = CanvasImage | Canvas3DModel | CanvasVideo;
```

#### B. New Components

| Component | File | Purpose |
|-----------|------|---------|
| **Model3DUploadPanel** | `components/Model3DUploadPanel.tsx` | Drag-drop upload zone for 3D files |
| **Model3DViewerModal** | `components/Model3DViewerModal.tsx` | Full-screen 3D viewer with controls |
| **Model3DCanvas** | `components/Model3DCanvas.tsx` | Three.js canvas wrapper component |

#### C. 3D Viewer Modal (Edit Mode)

**File: `components/Model3DViewerModal.tsx`**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [×] 3D Model Viewer - building_model.ifc                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────┐  ┌──────────────┐  │
│  │                                             │  │ VIEW PRESETS │  │
│  │                                             │  │              │  │
│  │                                             │  │ [Front]      │  │
│  │                                             │  │ [Back]       │  │
│  │           3D VIEWPORT                       │  │ [Left]       │  │
│  │                                             │  │ [Right]      │  │
│  │     🖱️ Drag to rotate                       │  │ [Top]        │  │
│  │     ⇧+Drag to pan                          │  │ [Bottom]     │  │
│  │     🖲️ Scroll to zoom                       │  │ [Isometric]  │  │
│  │                                             │  │              │  │
│  │                                             │  │ ──────────── │  │
│  │                                             │  │              │  │
│  │                                             │  │ DISPLAY      │  │
│  │                                             │  │ ☑ Grid       │  │
│  │                                             │  │ ☐ Wireframe  │  │
│  │                                             │  │ ☐ Axes       │  │
│  │                                             │  │              │  │
│  │                                             │  │ Model Color  │  │
│  │                                             │  │ [■ #808080]  │  │
│  │                                             │  │ ☐ Use orig.  │  │
│  │                                             │  │              │  │
│  │                                             │  │ Background   │  │
│  │                                             │  │ [■ #1a1a2e]  │  │
│  └─────────────────────────────────────────────┘  └──────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [↻ Reset View]  [⊡ Fit to Screen]              [📷 Take Screenshot] │
│                                                                     │
│  Screenshot Options:  Resolution [1x ▼]   ☐ Transparent background  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Orbit Controls**: Click and drag to rotate camera around model
- **Pan Controls**: Shift + drag to move camera laterally
- **Zoom Controls**: Mouse wheel to zoom in/out
- **View Presets**: One-click buttons for standard views (front, back, left, right, top, bottom, isometric)
- **Display Options**: Toggle grid, wireframe mode, axis helpers (for viewing assistance only)
- **Model Color**: Color picker to apply uniform color to entire model
- **Background Color**: Customizable background (useful for transparent screenshots)
- **Screenshot Capture**: Capture current view as PNG image (clean - no grid/axes)
- **Resolution Options**: 1x, 2x, 4x screenshot resolution multiplier

**IMPORTANT - Clean Screenshots:**
Screenshots capture ONLY the 3D model - grid, axes, and all helper elements are automatically hidden during capture. The screenshot contains just the model against the chosen background color (or transparent).

#### D. Screenshot Capture Logic

```typescript
// In Model3DViewerModal.tsx
const captureScreenshot = async () => {
  // 1. HIDE all helper elements before capture (clean screenshot)
  if (gridHelper) gridHelper.visible = false;
  if (axesHelper) axesHelper.visible = false;
  if (boundingBoxHelper) boundingBoxHelper.visible = false;
  // Hide any other non-model elements

  // 2. Get the Three.js renderer canvas
  const canvas = rendererRef.current.domElement;

  // 3. Render at requested resolution
  const multiplier = screenshotResolution; // 1, 2, or 4
  renderer.setSize(canvas.width * multiplier, canvas.height * multiplier);
  renderer.render(scene, camera);

  // 4. Convert to data URI
  const dataUri = canvas.toDataURL('image/png');

  // 5. Reset renderer size
  renderer.setSize(canvas.width, canvas.height);

  // 6. RESTORE helper visibility to previous state
  if (gridHelper) gridHelper.visible = showGrid;
  if (axesHelper) axesHelper.visible = showAxes;
  if (boundingBoxHelper) boundingBoxHelper.visible = showBoundingBox;

  // 7. Generate thumbnail for canvas display
  const thumbnailUri = await generateThumbnail(dataUri, 512);

  // 8. Create new canvas image
  const screenshotImage: CanvasImage = {
    id: `3d-screenshot-${Date.now()}-${crypto.randomUUID()}`,
    type: 'image',
    dataUri,
    thumbnailUri,
    x: getCanvasCenterX() - 150,  // Center on canvas
    y: getCanvasCenterY() - 150,
    width: 300,
    height: 300,
    originalWidth: canvas.width * multiplier,
    originalHeight: canvas.height * multiplier,
    selected: false,
    source: '3d-screenshot',
    sourceModelId: model.id,
  };

  // 9. Add to canvas via callback
  onScreenshotCapture(screenshotImage);

  // 10. Save to storage (Electron)
  if (window.electron) {
    await window.electron.saveThumbnail(sessionId, screenshotImage.id, thumbnailUri);
  }

  // 11. Show success toast
  showToast('Screenshot added to canvas');
};
```

#### E. Model Loaders

**File: `utils/model3DLoaders.ts`**

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

// GLB/GLTF Loader
export async function loadGLTF(fileOrPath: File | string): Promise<THREE.Group> {
  const loader = new GLTFLoader();

  // Enable Draco compression support
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);

  if (typeof fileOrPath === 'string') {
    const gltf = await loader.loadAsync(fileOrPath);
    return gltf.scene;
  } else {
    const arrayBuffer = await fileOrPath.arrayBuffer();
    const gltf = await loader.parseAsync(arrayBuffer, '');
    return gltf.scene;
  }
}

// OBJ Loader
export async function loadOBJ(
  objFile: File | string,
  mtlFile?: File | string
): Promise<THREE.Group> {
  const loader = new OBJLoader();

  // Load materials if provided
  if (mtlFile) {
    const mtlLoader = new MTLLoader();
    let materials;
    if (typeof mtlFile === 'string') {
      materials = await mtlLoader.loadAsync(mtlFile);
    } else {
      const mtlText = await mtlFile.text();
      materials = mtlLoader.parse(mtlText, '');
    }
    materials.preload();
    loader.setMaterials(materials);
  }

  if (typeof objFile === 'string') {
    return await loader.loadAsync(objFile);
  } else {
    const text = await objFile.text();
    return loader.parse(text);
  }
}

// IFC Loader (for architectural/BIM models)
export async function loadIFC(fileOrPath: File | string): Promise<THREE.Group> {
  const loader = new IFCLoader();
  await loader.ifcManager.setWasmPath('/wasm/');

  if (typeof fileOrPath === 'string') {
    return await loader.loadAsync(fileOrPath);
  } else {
    const arrayBuffer = await fileOrPath.arrayBuffer();
    return await loader.parse(arrayBuffer);
  }
}

// Auto-detect and load model by extension
export async function loadModel(
  file: File,
  mtlFile?: File
): Promise<{ scene: THREE.Group; type: 'glb' | 'obj' | 'ifc' }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'glb':
    case 'gltf':
      return { scene: await loadGLTF(file), type: 'glb' };
    case 'obj':
      return { scene: await loadOBJ(file, mtlFile), type: 'obj' };
    case 'ifc':
      return { scene: await loadIFC(file), type: 'ifc' };
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

// Generate initial thumbnail from model
export async function generateModelThumbnail(
  scene: THREE.Scene,
  camera: THREE.Camera,
  size: number = 512
): Promise<string> {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
  });
  renderer.setSize(size, size);
  renderer.render(scene, camera);
  const dataUri = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return dataUri;
}
```

#### F. Storage Structure

```
AppData/AREA49-Nano-Banana/storage/
├── models/
│   ├── model_1733664000000_abc123.glb
│   ├── model_1733664100000_def456.ifc
│   └── model_1733664200000_ghi789.obj
├── model_thumbnails/
│   └── {sessionId}/
│       ├── model-001.png
│       └── model-002.png
├── model_registry.json
└── ... (existing directories)
```

**model_registry.json:**
```json
{
  "models": [
    {
      "id": "model-abc123",
      "hash": "sha256:...",
      "originalName": "building.ifc",
      "modelType": "ifc",
      "fileSize": 15728640,
      "filePath": "models/model_1733664100000_def456.ifc",
      "thumbnailPath": "model_thumbnails/session-001/model-abc123.png",
      "boundingBox": { "min": {...}, "max": {...} },
      "vertexCount": 125000,
      "faceCount": 42000,
      "createdAt": "2024-12-08T10:30:00Z"
    }
  ]
}
```

### 1.5 Dependencies

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "web-ifc-three": "^0.0.124",
    "web-ifc": "^0.0.51"
  }
}
```

### 1.6 Canvas Integration

**3D Model Container on Canvas:**
```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [3D Thumbnail]   │  │  ← Preview always fitted to container
│  │                    │  │
│  │        🎲          │  │  ← 3D icon overlay
│  │                    │  │
│  └────────────────────┘  │
│  📦 building.ifc         │  ← File name + 3D badge
└──────────────────────────┘
     ↑ Double-click to open Edit Mode
```

**Container Behavior:**
- **Movable**: Drag anywhere on canvas
- **Resizable**: Corner/edge handles to resize
- **Aspect Ratio LOCKED**: When resizing, preview maintains original aspect ratio
- Preview image is always fitted inside container (object-fit: contain)

**Interactions:**
- Single click: Select/deselect
- Double-click: Open 3D Viewer Modal (Edit Mode)
- Drag: Move container on canvas
- Resize handles: Scale container (aspect ratio locked)
- Right-click: Context menu (Delete, Open Viewer, Change Color)

#### Model Color Change Logic

```typescript
// Apply uniform color to entire 3D model
const applyModelColor = (model: THREE.Group, color: string) => {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.7,
    metalness: 0.3
  });

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Store original material for "Use Original" toggle
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material;
      }
      child.material = material;
    }
  });
};

// Restore original materials
const restoreOriginalColors = (model: THREE.Group) => {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });
};
```

### 1.7 Persistence (Save/Load)

**Container State Persistence:**
All 3D model container properties are saved as part of the session and restored on load:

```typescript
// Saved to session's canvas_items array
interface PersistedCanvas3DModel {
  id: string;
  type: '3d-model';
  modelType: 'ifc' | 'glb' | 'obj';

  // Position & Size (PERSISTED)
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;

  // File references (PERSISTED)
  modelPath?: string;
  thumbnailPath?: string;
  fileName: string;
  fileSize: number;

  // Appearance (PERSISTED)
  modelColor?: string;
  useOriginalColors: boolean;

  // Camera state (PERSISTED - restore last view in edit mode)
  savedCameraPosition?: { x: number; y: number; z: number };
  savedCameraTarget?: { x: number; y: number; z: number };
}
```

**Save Triggers:**
- Auto-save interval (every 5 minutes)
- Manual save
- Session switch / app close
- After any container move/resize operation

**Load Behavior:**
- On session load, restore all 3D model containers at saved positions/sizes
- Thumbnails loaded from disk paths
- Model files loaded on-demand (when entering edit mode)

---

## Feature 2: Video Generation

### 2.1 Core Concept

Users can generate AI videos using the same workflow as image generation. Enter a prompt, optionally select reference images for style/content guidance, and generate a video that appears on the canvas. Videos have the same features as images: tagging, selection, use as reference for further generations.

### 2.2 User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SELECT GENERATION MODE                                       │
│     Toggle from "Image" to "Video" in generation controls       │
│                              ↓                                   │
│  2. COMPOSE PROMPT                                               │
│     Write prompt describing desired video content               │
│     (e.g., "A serene mountain lake with gentle ripples")        │
│                              ↓                                   │
│  3. SELECT REFERENCE IMAGES (Optional)                           │
│     Select images on canvas to guide video style/content        │
│     Tag as Control (composition) or Reference (style)           │
│                              ↓                                   │
│  4. CONFIGURE VIDEO PARAMETERS                                   │
│     - Duration: 5s, 10s, 15s                                    │
│     - Aspect Ratio: 16:9, 9:16, 1:1, 4:3                        │
│     - Quality: Standard, High                                    │
│                              ↓                                   │
│  5. GENERATE                                                     │
│     Click Generate button, video generation begins              │
│     Progress indicator shows generation status                   │
│                              ↓                                   │
│  6. VIDEO ON CANVAS                                              │
│     Generated video appears on canvas with thumbnail + play icon│
│     Can be played, used as reference, extracted to frames       │
│                              ↓                                   │
│  7. PLAYBACK & INTERACTION                                       │
│     Click to play inline or double-click for full player modal  │
│     Extract frames as images, download video file               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Type Definitions

**File: `types.ts`**

```typescript
// Video generation configuration (aligned with Google Veo API)
interface VideoGenerationConfig {
  model: 'veo-3.1-generate-preview' | 'veo-3.1-fast-generate-preview' | 'veo-2.0-generate-exp';
  duration: 4 | 6 | 8;             // Seconds (Veo supported values)
  aspectRatio: '16:9' | '9:16';    // Landscape or Portrait
  resolution?: '720p' | '1080p';   // Veo 3.1 only
  negativePrompt?: string;         // Content to avoid
  sampleCount?: 1 | 2 | 3 | 4;     // Number of videos to generate
}

// Canvas video item
interface CanvasVideo {
  id: string;
  type: 'video';

  // Video file references
  videoPath?: string;              // Electron: path on disk
  videoDataUri?: string;           // Web: base64 (small videos only)
  videoUrl?: string;               // Streaming URL if available

  // Canvas display
  thumbnailUri?: string;           // First frame thumbnail
  thumbnailPath?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;           // Original video width (for aspect ratio)
  originalHeight: number;          // Original video height (for aspect ratio)
  aspectRatio: number;             // Locked aspect ratio (width / height)
  selected: boolean;

  // Video metadata
  duration: number;                // Seconds
  fps: number;
  fileSize: number;
  mimeType: 'video/mp4' | 'video/webm';

  // Generation info (if AI-generated)
  generationId?: string;
  prompt?: string;
  inputImageIds?: string[];        // Reference images used

  // Tagging (same as images)
  tag?: 'control' | 'reference';
}

// Extended generation record
interface MixboardGeneration {
  // ... existing fields ...
  type: 'image' | 'video';
  videoConfig?: VideoGenerationConfig;
  outputVideos?: StoredVideoMeta[];
}
```

### 2.4 UI Components

#### A. Generation Mode Toggle

**Updated: `components/ParametersPanel.tsx`**

```
┌────────────────────────────────────────┐
│  Generation Type                        │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │     📷       │  │     🎬       │    │
│  │    Image     │  │    Video     │    │
│  │   [Active]   │  │              │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
└────────────────────────────────────────┘
```

#### B. Video Parameters (shown when Video mode selected)

```
┌────────────────────────────────────────┐
│  Video Settings                         │
│                                         │
│  Model                                  │
│  ┌──────────────────────────────────┐  │
│  │ Veo 3.1 (High Quality)        ▼  │  │
│  └──────────────────────────────────┘  │
│  Options: Veo 3.1, Veo 3.1 Fast, Veo 2 │
│                                         │
│  Duration                               │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 4s │  │ 6s │  │ 8s │                │
│  └────┘  └────┘  └────┘                │
│                                         │
│  Aspect Ratio                           │
│  ┌──────────────────────────────────┐  │
│  │ 16:9 (Landscape)              ▼  │  │
│  └──────────────────────────────────┘  │
│  Options: 16:9 (Landscape), 9:16 (Portrait) │
│                                         │
│  Resolution (Veo 3.1 only)             │
│  ○ 720p    ● 1080p                     │
│                                         │
│  ──────────────────────────────────    │
│  Advanced                               │
│  Negative Prompt: [________________]   │
│  (Describe what to avoid)              │
│                                         │
└────────────────────────────────────────┘
```

**Veo Model Comparison:**
- **Veo 3.1**: Highest quality, 1080p, native audio, 11s-6min generation
- **Veo 3.1 Fast**: Good quality, faster generation, ideal for iteration
- **Veo 2**: Supports style reference images, 720p only

#### C. Video Player Modal

**File: `components/VideoPlayerModal.tsx`**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [×] Video Player - generated_video_001.mp4                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │                                                               │  │
│  │                                                               │  │
│  │                     VIDEO PLAYBACK                            │  │
│  │                                                               │  │
│  │                                                               │  │
│  │                                                               │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ▶️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○  0:03 / 0:10   │
│                                                                     │
│  [🔊]  [🔁 Loop]                    [📷 Extract Frame]  [⬇ Download] │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Prompt: "A serene mountain lake with gentle ripples at sunset"     │
│  Duration: 10s | Resolution: 1920x1080 | Size: 12.4 MB              │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Standard video controls (play/pause, seek, volume)
- Loop toggle for continuous playback
- **Extract Frame**: Pause video and capture current frame as canvas image
- **Download**: Save video file to disk
- Generation info display (prompt, parameters)

#### D. Canvas Video Container

```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [Video Frame]    │  │  ← Thumbnail always fitted to container
│  │                    │  │
│  │        ▶️          │  │  ← Play button overlay
│  │                    │  │
│  └────────────────────┘  │
│  🎬 0:10                  │  ← Video badge + duration
└──────────────────────────┘
```

**Container Behavior:**
- **Movable**: Drag anywhere on canvas
- **Resizable**: Corner/edge handles to resize
- **Aspect Ratio LOCKED**: When resizing, thumbnail maintains original video aspect ratio
- Thumbnail is always fitted inside container (object-fit: contain)

**Interactions:**
- Single click: Select/deselect (can be tagged as control/reference)
- Double-click: Open Video Player Modal
- Drag: Move container on canvas
- Resize handles: Scale container (aspect ratio locked)
- Right-click: Context menu (Play, Delete, Tag as Control/Reference)

### 2.5 Video Generation Service - Google Veo API Integration

**File: `services/videoGenerationService.ts`**

#### Overview

This app integrates with **Google Veo** (via the Gemini API) for AI video generation. Veo is Google's state-of-the-art video generation model, available through the same `@google/genai` SDK used for image generation.

#### Available Veo Models

| Model | Resolution | Duration | Audio | Speed | Use Case |
|-------|------------|----------|-------|-------|----------|
| `veo-3.1-generate-preview` | 720p/1080p | 4-8s | Native | Standard | High quality |
| `veo-3.1-fast-generate-preview` | 720p/1080p | 4-8s | Native | Fast | Quick iterations |
| `veo-2.0-generate-exp` | 720p | 5-8s | No | Standard | Style references |

#### API Configuration

```typescript
// Video generation configuration (updated for Veo)
interface VeoVideoConfig {
  model: 'veo-3.1-generate-preview' | 'veo-3.1-fast-generate-preview' | 'veo-2.0-generate-exp';
  duration: 4 | 6 | 8;              // Seconds (Veo 3.x: 4, 6, 8)
  aspectRatio: '16:9' | '9:16';     // Landscape or Portrait
  resolution?: '720p' | '1080p';    // Veo 3.x only
  negativePrompt?: string;          // Content to avoid
  sampleCount?: 1 | 2 | 3 | 4;      // Number of videos to generate
  seed?: number;                    // For reproducibility
  personGeneration?: 'allow_adult' | 'dont_allow';  // Safety setting
}

// Request structure
interface VideoGenerationRequest {
  prompt: string;
  config: VeoVideoConfig;

  // Image-to-Video (optional)
  firstFrame?: {
    imageBytes: string;    // Base64 image data
    mimeType: string;      // 'image/png' | 'image/jpeg'
  };

  // First + Last Frame Interpolation (Veo 3.1 only)
  lastFrame?: {
    imageBytes: string;
    mimeType: string;
  };

  // Reference Images (up to 3 for subject consistency)
  referenceImages?: {
    imageBytes: string;
    mimeType: string;
  }[];
}

interface VideoGenerationResponse {
  success: boolean;
  videos: {
    videoUri: string;         // Download URL (valid for 2 days)
    mimeType: string;         // 'video/mp4'
    durationSeconds: number;
    width: number;
    height: number;
  }[];
  error?: string;
}
```

#### Implementation

```typescript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate video using Google Veo API
 */
export async function generateVideo(
  request: VideoGenerationRequest,
  onProgress?: (status: string, progress: number) => void
): Promise<VideoGenerationResponse> {

  try {
    // Build generation config
    const generateConfig: any = {
      aspectRatio: request.config.aspectRatio,
      numberOfVideos: request.config.sampleCount || 1,
    };

    // Add optional parameters
    if (request.config.resolution) {
      generateConfig.resolution = request.config.resolution;
    }
    if (request.config.negativePrompt) {
      generateConfig.negativePrompt = request.config.negativePrompt;
    }
    if (request.config.personGeneration) {
      generateConfig.personGeneration = request.config.personGeneration;
    }
    if (request.config.seed) {
      generateConfig.seed = request.config.seed;
    }

    // Add last frame for interpolation (Veo 3.1 only)
    if (request.lastFrame && request.config.model.includes('veo-3.1')) {
      generateConfig.lastFrame = {
        imageBytes: request.lastFrame.imageBytes,
        mimeType: request.lastFrame.mimeType,
      };
    }

    // Add reference images for subject consistency
    if (request.referenceImages && request.referenceImages.length > 0) {
      generateConfig.referenceImages = request.referenceImages.map(img => ({
        referenceType: 'REFERENCE_TYPE_SUBJECT',
        referenceId: 1,
        image: {
          imageBytes: img.imageBytes,
          mimeType: img.mimeType,
        },
      }));
    }

    // Start video generation (returns operation)
    onProgress?.('Starting video generation...', 0);

    let operation = await client.models.generateVideos({
      model: request.config.model,
      prompt: request.prompt,
      // First frame image (for image-to-video)
      ...(request.firstFrame && {
        image: {
          imageBytes: request.firstFrame.imageBytes,
          mimeType: request.firstFrame.mimeType,
        },
      }),
      config: generateConfig,
    });

    // Poll for completion (video generation takes 11 seconds to 6 minutes)
    let pollCount = 0;
    const maxPolls = 72;  // 6 minutes at 5-second intervals

    while (!operation.done && pollCount < maxPolls) {
      await sleep(5000);  // Poll every 5 seconds
      pollCount++;

      const progress = Math.min(95, (pollCount / maxPolls) * 100);
      onProgress?.('Generating video...', progress);

      operation = await client.operations.getVideosOperation({
        operation: operation,
      });
    }

    if (!operation.done) {
      throw new Error('Video generation timed out');
    }

    // Check for errors
    if (operation.error) {
      throw new Error(operation.error.message || 'Video generation failed');
    }

    onProgress?.('Video ready!', 100);

    // Extract video results
    const videos = operation.response?.generatedVideos || [];

    return {
      success: true,
      videos: videos.map((v: any) => ({
        videoUri: v.video.uri,
        mimeType: v.video.mimeType || 'video/mp4',
        durationSeconds: request.config.duration,
        width: request.config.resolution === '1080p' ? 1920 : 1280,
        height: request.config.resolution === '1080p' ? 1080 : 720,
      })),
    };

  } catch (error: any) {
    return {
      success: false,
      videos: [],
      error: error.message || 'Unknown error during video generation',
    };
  }
}

/**
 * Download video from Veo URL to local storage
 * IMPORTANT: Videos expire after 2 days!
 */
export async function downloadVideo(
  videoUri: string,
  savePath: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const response = await fetch(videoUri);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Save to disk via Electron IPC
    if (window.electron) {
      const localPath = await window.electron.saveVideo(savePath, arrayBuffer);
      return { success: true, localPath };
    } else {
      // Web fallback: return as data URI
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return { success: true, localPath: `data:video/mp4;base64,${base64}` };
    }

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract a single frame from video at specified time
 */
export async function extractFrame(
  videoElement: HTMLVideoElement,
  timeSeconds: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const seekHandler = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoElement, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      } finally {
        videoElement.removeEventListener('seeked', seekHandler);
      }
    };

    videoElement.addEventListener('seeked', seekHandler);
    videoElement.currentTime = timeSeconds;
  });
}

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Veo API Features Summary

| Feature | Veo 2 | Veo 3.1 | Veo 3.1 Fast |
|---------|-------|---------|--------------|
| Text-to-Video | ✅ | ✅ | ✅ |
| Image-to-Video | ✅ | ✅ | ✅ |
| First+Last Frame | ❌ | ✅ | ✅ |
| Reference Images (Subject) | ✅ | ✅ | ✅ |
| Style Images | ✅ | ❌ | ❌ |
| Native Audio | ❌ | ✅ | ✅ |
| 1080p Resolution | ❌ | ✅ | ✅ |
| 9:16 Vertical | ❌ | ✅ | ✅ |

#### Pricing (Approximate)

| Model | Resolution | Cost |
|-------|------------|------|
| Veo 2 | 720p | ~$0.35/second |
| Veo 3.1 | 720p | Contact Google |
| Veo 3.1 | 1080p | Contact Google |
| Veo 3.1 Fast | 720p/1080p | Lower than Veo 3.1 |

*Note: Pricing is in paid preview. Check Google AI Studio for current rates.*

#### Important Limitations

1. **Video Retention**: Generated videos are stored on Google servers for **2 days only**. Download immediately after generation.

2. **Latency**: Generation takes 11 seconds to 6 minutes depending on complexity and server load.

3. **Safety Filters**: Videos may be blocked by safety filters. No charge if blocked.

4. **SynthID Watermark**: All Veo videos are watermarked with SynthID (invisible, detectable).

5. **Regional Restrictions**: Some `personGeneration` options limited in EU/UK/CH/MENA.

6. **First+Last Frame**: Only available in Veo 3.1 models.

7. **Style Images**: Only supported in Veo 2, not Veo 3.1.

#### Integration with Existing Image Generation

Since this app already uses `@google/genai` for Gemini image generation, the same API key and SDK can be used for Veo video generation. The workflow is:

1. User composes prompt (same as image generation)
2. User selects "Video" generation mode
3. User configures video parameters (duration, aspect ratio, resolution)
4. Optionally selects canvas images as:
   - **First Frame**: Starting point for image-to-video
   - **Last Frame**: Ending point for interpolation (Veo 3.1)
   - **Reference Images**: For subject/style consistency
5. Click Generate → Veo API call
6. Poll for completion (show progress)
7. Download video to local storage
8. Generate thumbnail from first frame
9. Add to canvas as CanvasVideo item

### 2.6 Video Thumbnail Generation

**File: `utils/imageUtils.ts` (additions)**

```typescript
// Generate thumbnail from video file
export async function generateVideoThumbnail(
  videoSource: File | string,
  seekTime: number = 0,
  maxDimension: number = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      // Seek to specified time (or 10% into video if 0)
      video.currentTime = seekTime || video.duration * 0.1;
    };

    video.onseeked = () => {
      // Calculate thumbnail dimensions
      const scale = Math.min(
        maxDimension / video.videoWidth,
        maxDimension / video.videoHeight
      );
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);

      // Draw frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, width, height);

      // Cleanup and return
      const dataUri = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(video.src);
      video.remove();
      resolve(dataUri);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    // Set source
    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      video.src = URL.createObjectURL(videoSource);
    }
  });
}
```

### 2.7 Storage Structure

```
AppData/AREA49-Nano-Banana/storage/
├── videos/
│   ├── video_1733664000000_abc123.mp4
│   └── video_1733664100000_def456.webm
├── video_thumbnails/
│   └── {sessionId}/
│       ├── video-001.jpg
│       └── video-002.jpg
├── video_registry.json
└── ... (existing directories)
```

**video_registry.json:**
```json
{
  "videos": [
    {
      "id": "video-abc123",
      "hash": "sha256:...",
      "originalName": "generated_video_001.mp4",
      "mimeType": "video/mp4",
      "fileSize": 13042688,
      "filePath": "videos/video_1733664000000_abc123.mp4",
      "thumbnailPath": "video_thumbnails/session-001/video-abc123.jpg",
      "duration": 10.0,
      "width": 1920,
      "height": 1080,
      "fps": 24,
      "generationId": "gen-xyz789",
      "prompt": "A serene mountain lake...",
      "createdAt": "2024-12-08T10:30:00Z"
    }
  ]
}
```

### 2.8 Integration with Existing Systems

#### A. Generation Flow Update

**In `MixboardView.tsx` handleGenerate:**

```typescript
const handleGenerate = async () => {
  if (generationType === 'video') {
    // Video generation flow
    const videoConfig: VideoGenerationConfig = {
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
      quality: videoQuality,
      fps: 24,
    };

    // Show progress indicator (videos take longer)
    setVideoGenerationProgress(0);
    setIsGeneratingVideo(true);

    try {
      const result = await generateVideo({
        prompt,
        referenceImages: { controlImages, referenceImages },
        config: videoConfig,
      }, apiKey, (progress) => {
        setVideoGenerationProgress(progress);
      });

      // Create canvas video item
      const newVideo: CanvasVideo = {
        id: `video-${Date.now()}-${crypto.randomUUID()}`,
        type: 'video',
        videoUrl: result.videoUrl,
        thumbnailUri: result.thumbnailUrl,
        // ... other properties
      };

      setCanvasVideos(prev => [...prev, newVideo]);

    } finally {
      setIsGeneratingVideo(false);
    }

  } else {
    // Existing image generation flow
    // ...
  }
};
```

#### B. Canvas Rendering Update

Videos render alongside images with play overlay:

```tsx
{canvasVideos.map(video => (
  <div
    key={video.id}
    className="canvas-video-container"
    style={{
      position: 'absolute',
      left: video.x * zoom + panOffset.x,
      top: video.y * zoom + panOffset.y,
      width: video.width * zoom,
      height: video.height * zoom,
    }}
    onClick={() => handleVideoClick(video)}
    onDoubleClick={() => openVideoPlayer(video)}
  >
    <img
      src={video.thumbnailUri}
      alt=""
      className="w-full h-full object-cover"
    />
    {/* Play button overlay */}
    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
      <PlayCircle className="w-12 h-12 text-white" />
    </div>
    {/* Duration badge */}
    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
      {formatDuration(video.duration)}
    </div>
    {/* Video type badge */}
    <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
      <Video className="w-3 h-3" />
      Video
    </div>
  </div>
))}
```

#### C. GraphView Integration

Videos appear in generation history graph with video icon:

```tsx
// In GraphView node rendering
{node.type === 'video' && (
  <Video className="w-4 h-4 text-purple-500" />
)}
```

### 2.9 Persistence (Save/Load)

**Container State Persistence:**
All video container properties are saved as part of the session and restored on load:

```typescript
// Saved to session's canvas_items array
interface PersistedCanvasVideo {
  id: string;
  type: 'video';

  // Position & Size (PERSISTED)
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;

  // File references (PERSISTED)
  videoPath?: string;
  thumbnailPath?: string;

  // Video metadata (PERSISTED)
  duration: number;
  fps: number;
  fileSize: number;
  mimeType: 'video/mp4' | 'video/webm';

  // Generation info (PERSISTED)
  generationId?: string;
  prompt?: string;
  inputImageIds?: string[];

  // Tagging (PERSISTED)
  tag?: 'control' | 'reference';
}
```

**Save Triggers:**
- Auto-save interval (every 5 minutes)
- Manual save
- Session switch / app close
- After any container move/resize operation
- After tagging change

**Load Behavior:**
- On session load, restore all video containers at saved positions/sizes
- Thumbnails loaded from disk paths
- Video files streamed from disk on playback

---

## Feature 3: Gallery Integration

### 3.1 Overview

The Gallery displays all canvas items (images, videos, 3D models) with filtering capabilities. Users can filter by item type and quickly add items back to the canvas.

### 3.2 Gallery UI

**File: `components/GalleryPanel.tsx` (Updated)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Gallery                                                    [×]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filter by Type:                                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │   All   │ │  📷     │ │  🎬     │ │  🎲     │                   │
│  │  (24)   │ │ Images  │ │ Videos  │ │   3D    │                   │
│  │ [Active]│ │  (15)   │ │   (5)   │ │   (4)   │                   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │   │
│  │ │ 📷  │ │ 📷  │ │ 🎬  │ │ 📷  │ │ 🎲  │ │ 📷  │ │ 🎬  │    │   │
│  │ │     │ │     │ │ ▶️  │ │     │ │     │ │     │ │ ▶️  │    │   │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │   │
│  │                                                             │   │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │   │
│  │ │ 🎲  │ │ 📷  │ │ 📷  │ │ 🎬  │ │ 🎲  │ │ 📷  │ │ 📷  │    │   │
│  │ │     │ │     │ │     │ │ ▶️  │ │     │ │     │ │     │    │   │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Filter Types

```typescript
type GalleryFilterType = 'all' | 'image' | 'video' | '3d-model';

interface GalleryFilter {
  type: GalleryFilterType;
  count: number;  // Number of items matching this filter
}

// Filter logic
const filterGalleryItems = (
  items: CanvasItem[],
  filter: GalleryFilterType
): CanvasItem[] => {
  if (filter === 'all') return items;
  return items.filter(item => item.type === filter);
};
```

### 3.4 Gallery Item Display

Each item type has a distinct visual indicator:

**Image Items:**
```
┌─────────────┐
│             │
│   [Image]   │
│             │
│ 📷 filename │
└─────────────┘
```

**Video Items:**
```
┌─────────────┐
│             │
│ [Thumbnail] │
│     ▶️      │  ← Play icon overlay
│             │
│ 🎬 0:10     │  ← Duration badge
└─────────────┘
```

**3D Model Items:**
```
┌─────────────┐
│             │
│ [3D Preview]│
│     🎲      │  ← 3D icon overlay
│             │
│ 📦 model.glb│  ← File name
└─────────────┘
```

### 3.5 Gallery Interactions

**All Item Types:**
- Click: Select item (shows details)
- Double-click: Add to canvas at center
- Right-click: Context menu
  - Add to Canvas
  - Delete from Gallery
  - View Details

**Type-Specific Actions:**
- **Images**: Same as existing (tag, edit, use as reference)
- **Videos**: Play preview on hover, open player modal
- **3D Models**: Open 3D viewer modal

### 3.6 Gallery Item Type Definition

```typescript
interface GalleryItem {
  id: string;
  type: 'image' | 'video' | '3d-model';
  thumbnailUri: string;
  thumbnailPath?: string;
  createdAt: string;
  sessionId: string;

  // Type-specific metadata
  // Images
  generationId?: string;
  prompt?: string;

  // Videos
  duration?: number;
  videoPath?: string;

  // 3D Models
  fileName?: string;
  modelType?: 'ifc' | 'glb' | 'obj';
  modelPath?: string;
}
```

### 3.7 Storage Integration

**Updated Session Structure:**
```typescript
interface MixboardSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;

  // Canvas items (all types)
  canvas_items: CanvasItem[];  // Union of CanvasImage | CanvasVideo | Canvas3DModel

  // Legacy support (images only) - deprecated
  canvas_images?: CanvasImage[];

  // Generations (images + videos)
  generations: MixboardGeneration[];

  // Other existing fields...
}
```

**Unified Canvas Items Array:**
```typescript
// All canvas item types stored together
type CanvasItem = CanvasImage | CanvasVideo | Canvas3DModel;

// Type guard helpers
const isImage = (item: CanvasItem): item is CanvasImage =>
  item.type === 'image';

const isVideo = (item: CanvasItem): item is CanvasVideo =>
  item.type === 'video';

const is3DModel = (item: CanvasItem): item is Canvas3DModel =>
  item.type === '3d-model';
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

| Task | Component | Priority |
|------|-----------|----------|
| Add type definitions for 3D models and videos | `types.ts` | High |
| Update storage service for models/videos | `storageV2.ts` | High |
| Add Electron IPC handlers | `electron-main.cjs` | High |
| Install Three.js dependencies | `package.json` | High |

### Phase 2: 3D Model Feature (Week 2-3)

| Task | Component | Priority |
|------|-----------|----------|
| Create model upload panel | `Model3DUploadPanel.tsx` | High |
| Implement model loaders (GLB, OBJ) | `model3DLoaders.ts` | High |
| Create 3D Viewer Modal | `Model3DViewerModal.tsx` | High |
| Add orbit/pan/zoom controls | `Model3DViewerModal.tsx` | High |
| Implement view presets | `Model3DViewerModal.tsx` | Medium |
| Implement screenshot capture | `Model3DViewerModal.tsx` | High |
| Add screenshot → canvas flow | `MixboardView.tsx` | High |
| Add canvas 3D model rendering | `MixboardView.tsx` | Medium |
| Implement IFC loader | `model3DLoaders.ts` | Medium |
| Add WASM/Draco assets | `public/` | Medium |

### Phase 3: Video Generation Feature (Week 4-5)

| Task | Component | Priority |
|------|-----------|----------|
| Add generation mode toggle | `ParametersPanel.tsx` | High |
| Add video parameters UI | `ParametersPanel.tsx` | High |
| Create video thumbnail generator | `imageUtils.ts` | High |
| Create VideoPlayerModal | `VideoPlayerModal.tsx` | High |
| Implement canvas video rendering | `MixboardView.tsx` | High |
| Implement frame extraction | `VideoPlayerModal.tsx` | Medium |
| Create video generation service stub | `videoGenerationService.ts` | Medium |
| Integrate real video API | `videoGenerationService.ts` | Low* |
| Add video to GraphView | `GraphView.tsx` | Low |

*Depends on API availability

### Phase 4: Gallery Integration (Week 6)

| Task | Component | Priority |
|------|-----------|----------|
| Add type filter buttons to Gallery | `GalleryPanel.tsx` | High |
| Implement filter logic (all/image/video/3d) | `GalleryPanel.tsx` | High |
| Add 3D model items to gallery | `GalleryPanel.tsx` | High |
| Add video items to gallery | `GalleryPanel.tsx` | High |
| Type-specific thumbnails and badges | `GalleryPanel.tsx` | Medium |
| Gallery item count per type | `GalleryPanel.tsx` | Medium |
| Double-click to add to canvas | `GalleryPanel.tsx` | Medium |

### Phase 5: Persistence & Polish (Week 7)

| Task | Component | Priority |
|------|-----------|----------|
| Save/load 3D model container state | `storageV2.ts` | High |
| Save/load video container state | `storageV2.ts` | High |
| Unified canvas_items array | `storageV2.ts` | High |
| Migration from canvas_images to canvas_items | `migrationService.ts` | Medium |
| Error handling and edge cases | Various | High |
| Loading states and progress indicators | Various | High |
| Keyboard shortcuts | Various | Medium |
| Performance optimization | Various | Medium |
| Documentation and help text | Various | Low |

---

## Technical Considerations

### Performance

- **3D Models**: Lazy load when entering edit mode; don't parse until needed
- **Large IFC Files**: Use Web Workers for parsing to avoid UI blocking
- **Videos**: Stream from disk; never load entire video into memory
- **Thumbnails**: Generate asynchronously; show skeleton loaders

### File Size Recommendations

| File Type | Recommended Max | Hard Limit |
|-----------|-----------------|------------|
| GLB/GLTF | 50 MB | 200 MB |
| OBJ | 50 MB | 200 MB |
| IFC | 100 MB | 500 MB |
| Video | 100 MB | 500 MB |

### Browser/Electron Compatibility

- Three.js requires WebGL 2.0 (all modern browsers)
- Video: MP4/H.264 universally supported
- IFC WASM requires SharedArrayBuffer (Electron OK, web needs COOP/COEP headers)

### Error Handling

- Graceful fallback if 3D model fails to load
- Clear error messages for unsupported formats
- Retry logic for video generation API failures
- Timeout handling for long operations

---

## File Structure After Implementation

```
/components/
├── Model3DUploadPanel.tsx        [NEW]
├── Model3DViewerModal.tsx        [NEW]
├── Model3DCanvas.tsx             [NEW]
├── VideoPlayerModal.tsx          [NEW]
├── GalleryPanel.tsx              [UPDATED] - Type filtering added
├── MixboardView.tsx              [UPDATED]
├── ParametersPanel.tsx           [UPDATED]
├── GraphView.tsx                 [UPDATED]
└── ...

/services/
├── storageV2.ts                  [UPDATED] - Unified canvas_items, persistence
├── migrationService.ts           [UPDATED] - canvas_images → canvas_items migration
├── videoGenerationService.ts     [NEW]
└── ...

/utils/
├── imageUtils.ts                 [UPDATED]
├── model3DLoaders.ts             [NEW]
└── ...

/types.ts                         [UPDATED] - CanvasItem union type, GalleryFilterType

/public/
├── draco/                        [NEW] - Draco decoder for compressed GLB
│   ├── draco_decoder.wasm
│   └── draco_decoder.js
└── wasm/                         [NEW] - IFC WASM files
    ├── web-ifc.wasm
    └── web-ifc-mt.wasm
```

---

## Success Criteria

### 3D Model Feature
- [ ] Can upload GLB, OBJ, and IFC files via drag-drop
- [ ] 3D model appears on canvas with preview thumbnail in container
- [ ] Container is movable (drag to reposition)
- [ ] Container is resizable with LOCKED aspect ratio
- [ ] Preview thumbnail always fitted to container
- [ ] Double-click opens 3D Viewer Modal
- [ ] Can orbit, pan, and zoom around model
- [ ] View presets work (front, back, top, etc.)
- [ ] Can change model color (uniform color for entire model)
- [ ] Can toggle between custom color and original materials
- [ ] Screenshot capture adds image to canvas
- [ ] Screenshots are CLEAN (no grid, axes, or helpers visible)
- [ ] Screenshots can be used for AI generation
- [ ] **PERSISTENCE**: Container position/size saved to session
- [ ] **PERSISTENCE**: Container position/size restored on session load
- [ ] **PERSISTENCE**: Model color and camera state persisted

### Video Generation Feature
- [ ] Can toggle between Image and Video generation modes
- [ ] Video parameters panel shows when Video mode selected
- [ ] Video generation initiates with progress indicator
- [ ] Generated video appears on canvas with thumbnail in container
- [ ] Container is movable (drag to reposition)
- [ ] Container is resizable with LOCKED aspect ratio
- [ ] Thumbnail always fitted to container
- [ ] Can play video in modal player
- [ ] Can extract frames from video as images
- [ ] Videos can be tagged as control/reference
- [ ] **PERSISTENCE**: Container position/size saved to session
- [ ] **PERSISTENCE**: Container position/size restored on session load
- [ ] **PERSISTENCE**: Video metadata and tags persisted

### Gallery Integration
- [ ] Gallery shows all item types (images, videos, 3D models)
- [ ] Filter buttons: All, Images, Videos, 3D Models
- [ ] Filter shows item count per type (e.g., "Images (15)")
- [ ] Each item type has distinct visual indicator/badge
- [ ] Videos show play icon overlay and duration badge
- [ ] 3D models show 3D icon overlay and file name
- [ ] Double-click adds item to canvas at center
- [ ] Right-click context menu works for all types
- [ ] Filter selection persists during session
