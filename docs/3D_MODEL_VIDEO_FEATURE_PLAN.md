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
  originalWidth: number;
  originalHeight: number;
  selected: boolean;

  // 3D metadata
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  vertexCount?: number;
  faceCount?: number;

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
- **Display Options**: Toggle grid, wireframe mode, axis helpers
- **Background Color**: Customizable background (useful for transparent screenshots)
- **Screenshot Capture**: Capture current view as PNG image
- **Resolution Options**: 1x, 2x, 4x screenshot resolution multiplier

#### D. Screenshot Capture Logic

```typescript
// In Model3DViewerModal.tsx
const captureScreenshot = async () => {
  // 1. Get the Three.js renderer canvas
  const canvas = rendererRef.current.domElement;

  // 2. Render at requested resolution
  const multiplier = screenshotResolution; // 1, 2, or 4
  renderer.setSize(canvas.width * multiplier, canvas.height * multiplier);
  renderer.render(scene, camera);

  // 3. Convert to data URI
  const dataUri = canvas.toDataURL('image/png');

  // 4. Reset renderer size
  renderer.setSize(canvas.width, canvas.height);

  // 5. Generate thumbnail for canvas display
  const thumbnailUri = await generateThumbnail(dataUri, 512);

  // 6. Create new canvas image
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

  // 7. Add to canvas via callback
  onScreenshotCapture(screenshotImage);

  // 8. Save to storage (Electron)
  if (window.electron) {
    await window.electron.saveThumbnail(sessionId, screenshotImage.id, thumbnailUri);
  }

  // 9. Show success toast
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

**3D Model on Canvas:**
```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [3D Thumbnail]   │  │
│  │                    │  │
│  │        🎲          │  │  ← 3D icon overlay
│  │                    │  │
│  └────────────────────┘  │
│  📦 building.ifc         │  ← File name + 3D badge
└──────────────────────────┘
     ↑ Double-click to open Edit Mode
```

**Interactions:**
- Single click: Select/deselect
- Double-click: Open 3D Viewer Modal (Edit Mode)
- Drag: Move on canvas
- Resize handles: Scale the preview
- Right-click: Context menu (Delete, Open Viewer)

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
// Video generation configuration
interface VideoGenerationConfig {
  duration: 5 | 10 | 15;           // Seconds
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  quality: 'standard' | 'high';
  fps: 24 | 30;                    // Frames per second
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
  originalWidth: number;
  originalHeight: number;
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
│  Duration                               │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 5s │  │10s │  │15s │                │
│  └────┘  └────┘  └────┘                │
│                                         │
│  Aspect Ratio                           │
│  ┌──────────────────────────────────┐  │
│  │ 16:9 (Landscape)              ▼  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  Quality                                │
│  ○ Standard    ● High                  │
│                                         │
└────────────────────────────────────────┘
```

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

#### D. Canvas Video Display

```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [Video Frame]    │  │
│  │                    │  │
│  │        ▶️          │  │  ← Play button overlay
│  │                    │  │
│  └────────────────────┘  │
│  🎬 0:10                  │  ← Video badge + duration
└──────────────────────────┘
```

### 2.5 Video Generation Service

**File: `services/videoGenerationService.ts`**

```typescript
interface VideoGenerationRequest {
  prompt: string;
  referenceImages?: {
    controlImages: string[];    // Base64 images for composition
    referenceImages: string[];  // Base64 images for style
  };
  config: VideoGenerationConfig;
}

interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;            // URL to generated video
  videoData?: ArrayBuffer;      // Video binary data
  thumbnailUrl?: string;        // First frame thumbnail
  metadata: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    fileSize: number;
  };
  error?: string;
}

// Video generation (API integration point)
export async function generateVideo(
  request: VideoGenerationRequest,
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<VideoGenerationResponse> {

  // API INTEGRATION NOTES:
  //
  // Current options for video generation APIs:
  //
  // 1. Google Veo 2 (Recommended - when API available)
  //    - Same ecosystem as Gemini
  //    - High quality results
  //    - Status: API not yet publicly available
  //
  // 2. Runway Gen-3 Alpha
  //    - REST API available
  //    - High quality, good motion
  //    - Requires separate API key
  //
  // 3. Pika Labs API
  //    - Good for stylized content
  //    - API access available
  //
  // 4. Stable Video Diffusion (via Replicate)
  //    - Open source option
  //    - Self-hostable
  //
  // 5. Kling AI
  //    - Good quality
  //    - API available in some regions

  // Placeholder implementation
  throw new Error('Video generation API not yet configured');
}

// Poll for generation status (video generation can take minutes)
export async function pollGenerationStatus(
  generationId: string,
  apiKey: string
): Promise<{ status: 'pending' | 'processing' | 'completed' | 'failed'; progress: number }> {
  // Implementation depends on chosen API
}

// Extract frame from video at specific time
export async function extractFrame(
  videoElement: HTMLVideoElement,
  timeSeconds: number
): Promise<string> {
  return new Promise((resolve) => {
    videoElement.currentTime = timeSeconds;
    videoElement.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoElement, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
  });
}
```

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

### Phase 4: Polish & Integration (Week 6)

| Task | Priority |
|------|----------|
| Error handling and edge cases | High |
| Loading states and progress indicators | High |
| Keyboard shortcuts | Medium |
| Performance optimization | Medium |
| Cross-feature integration (3D model rotation video) | Low |
| Documentation and help text | Low |

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
├── MixboardView.tsx              [UPDATED]
├── ParametersPanel.tsx           [UPDATED]
├── GraphView.tsx                 [UPDATED]
└── ...

/services/
├── storageV2.ts                  [UPDATED]
├── videoGenerationService.ts     [NEW]
└── ...

/utils/
├── imageUtils.ts                 [UPDATED]
├── model3DLoaders.ts             [NEW]
└── ...

/types.ts                         [UPDATED]

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
- [ ] 3D model appears on canvas with preview thumbnail
- [ ] Double-click opens 3D Viewer Modal
- [ ] Can orbit, pan, and zoom around model
- [ ] View presets work (front, back, top, etc.)
- [ ] Screenshot capture adds image to canvas
- [ ] Screenshots can be used for AI generation

### Video Generation Feature
- [ ] Can toggle between Image and Video generation modes
- [ ] Video parameters panel shows when Video mode selected
- [ ] Video generation initiates with progress indicator
- [ ] Generated video appears on canvas with thumbnail
- [ ] Can play video in modal player
- [ ] Can extract frames from video as images
- [ ] Videos can be tagged as control/reference
- [ ] Videos saved to disk and persist across sessions
