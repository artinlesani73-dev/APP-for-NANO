# 3D Model Upload & Video Generation Feature Plan

## Overview

This document outlines the implementation plan for two major features:
1. **3D Model Upload & Screenshot Capture** - Upload IFC, GLB, and OBJ files to the canvas with an interactive viewer for taking screenshots
2. **Video Generation** - Generate videos with the same features and functions as images

---

## Feature 1: 3D Model Upload & Screenshot Capture

### 1.1 User Flow

```
Upload 3D File (IFC/GLB/OBJ)
    ↓
Model appears on canvas (as thumbnail/preview)
    ↓
Double-click to enter Edit Mode (3D Viewer Modal)
    ↓
User rotates/pans/zooms to desired view
    ↓
Click "Take Screenshot" button
    ↓
Screenshot automatically saved as canvas image
    ↓
User can continue taking more screenshots or exit
```

### 1.2 Implementation Components

#### A. Type System Extensions

**File: `/types.ts`**

```typescript
// Add new canvas item type
interface Canvas3DModel {
  id: string;
  type: '3d-model';
  modelType: 'ifc' | 'glb' | 'obj';

  // File references
  modelPath?: string;           // Electron file path
  modelDataUri?: string;        // Base64 for web (GLB/OBJ only, IFC too large)

  // Canvas display
  thumbnailUri?: string;        // Preview image for canvas
  thumbnailPath?: string;       // Disk reference

  // Position & size on canvas
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;

  // Metadata
  fileName: string;
  fileSize: number;
  selected: boolean;

  // 3D specific
  defaultCameraPosition?: { x: number; y: number; z: number };
  defaultCameraTarget?: { x: number; y: number; z: number };
}

// Extend CanvasImage union type
type CanvasItem = CanvasImage | Canvas3DModel;
```

#### B. 3D Model Upload Component

**New File: `/components/Model3DUploadPanel.tsx`**

```typescript
// Features:
// - Drag-drop zone for .ifc, .glb, .obj files
// - File type validation
// - Size limit warnings (IFC can be large)
// - Loading indicator during model parsing
// - Auto-generate initial thumbnail from default view
```

**Supported MIME Types:**
- `.glb` - `model/gltf-binary`
- `.gltf` - `model/gltf+json`
- `.obj` - `text/plain` or `model/obj`
- `.ifc` - `application/x-step` or custom handling

#### C. 3D Viewer Modal (Edit Mode)

**New File: `/components/Model3DViewerModal.tsx`**

```typescript
// Dependencies:
// - three.js (core 3D rendering)
// - @react-three/fiber (React integration)
// - @react-three/drei (helpers: OrbitControls, etc.)
// - web-ifc-three (IFC file loading)

// Features:
// 1. Interactive 3D viewport
//    - Orbit controls (rotate around model)
//    - Pan controls (shift + drag)
//    - Zoom controls (scroll wheel)
//    - Reset view button
//
// 2. View presets
//    - Front, Back, Left, Right, Top, Bottom
//    - Isometric views
//    - Fit to screen
//
// 3. Display options
//    - Wireframe toggle
//    - Background color picker
//    - Grid toggle
//    - Axes helper toggle
//
// 4. Screenshot capture
//    - "Take Screenshot" button
//    - Auto-save to canvas as new image
//    - Screenshot resolution options (1x, 2x, 4x)
//    - Transparent background option
//
// 5. Model info panel
//    - File name, size
//    - Vertex/face count
//    - Bounding box dimensions
```

**Screenshot Capture Flow:**
```typescript
const captureScreenshot = async () => {
  // 1. Get WebGL canvas from Three.js renderer
  const canvas = gl.domElement;

  // 2. Convert to data URL
  const dataUri = canvas.toDataURL('image/png');

  // 3. Generate thumbnail
  const thumbnailUri = await generateThumbnail(dataUri, 512);

  // 4. Create new canvas image
  const newImage: CanvasImage = {
    id: `screenshot-${Date.now()}-${uuidv4()}`,
    type: 'image',
    dataUri,
    thumbnailUri,
    x: calculateCenterX(),
    y: calculateCenterY(),
    width: canvas.width,
    height: canvas.height,
    originalWidth: canvas.width,
    originalHeight: canvas.height,
    selected: false,
    source: '3d-screenshot',
    sourceModelId: model.id,
  };

  // 5. Add to canvas
  onAddImage(newImage);

  // 6. Save thumbnail to disk (Electron)
  await saveThumbnail(newImage.id, thumbnailUri);
};
```

#### D. File Loaders

**New File: `/utils/model3DLoaders.ts`**

```typescript
// GLB/GLTF Loader
export const loadGLTF = async (file: File): Promise<THREE.Group> => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);

  const arrayBuffer = await file.arrayBuffer();
  const gltf = await loader.parseAsync(arrayBuffer, '');
  return gltf.scene;
};

// OBJ Loader
export const loadOBJ = async (file: File, mtlFile?: File): Promise<THREE.Group> => {
  const loader = new OBJLoader();
  if (mtlFile) {
    const mtlLoader = new MTLLoader();
    const materials = await mtlLoader.loadAsync(mtlFile);
    loader.setMaterials(materials);
  }
  const text = await file.text();
  return loader.parse(text);
};

// IFC Loader
export const loadIFC = async (file: File): Promise<THREE.Group> => {
  const loader = new IFCLoader();
  await loader.ifcManager.setWasmPath('/wasm/');
  const arrayBuffer = await file.arrayBuffer();
  return await loader.parse(arrayBuffer);
};

// Generate initial thumbnail
export const generateModelThumbnail = async (
  scene: THREE.Scene,
  camera: THREE.Camera,
  width = 512,
  height = 512
): Promise<string> => {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
```

#### E. Storage Extensions

**Updates to: `/services/storageV2.ts`**

```typescript
// Add 3D model registry (similar to image_registry.json)
// File: model_registry.json

interface ModelRegistryEntry {
  id: string;
  hash: string;              // SHA256 of model file
  originalName: string;
  modelType: 'ifc' | 'glb' | 'obj';
  fileSize: number;
  filePath: string;          // Path to stored model file
  thumbnailPath: string;     // Path to preview thumbnail
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  vertexCount?: number;
  faceCount?: number;
  createdAt: string;
}

// File storage structure:
// ~/Documents/ImageProvenanceStudio/users/{user}/
//   ├── models/
//   │   ├── model_1733664000000_abc123.glb
//   │   ├── model_1733664100000_def456.ifc
//   │   └── model_1733664200000_ghi789.obj
//   ├── model_thumbnails/
//   │   └── {sessionId}/
//   │       ├── model-001.png
//   │       └── model-002.png
//   └── model_registry.json
```

#### F. Electron IPC Handlers

**Updates to: `/electron-main.cjs`**

```javascript
// New IPC handlers for 3D models
ipcMain.handle('save-model-sync', async (event, { fileName, data, modelType }) => {
  // Save model file to models/ directory
  // Return file path
});

ipcMain.handle('load-model-sync', async (event, { filePath }) => {
  // Load model file from disk
  // Return as base64 or ArrayBuffer
});

ipcMain.handle('save-model-thumbnail-sync', async (event, { sessionId, modelId, thumbnailData }) => {
  // Save model preview thumbnail
});
```

### 1.3 UI/UX Design

#### Canvas Display
- 3D models appear as preview thumbnails on canvas
- Visual indicator (3D icon badge) to distinguish from regular images
- Same drag/resize behavior as images
- Double-click opens 3D Viewer Modal

#### 3D Viewer Modal Layout
```
┌────────────────────────────────────────────────────────────┐
│  [×] Model3DViewer - filename.glb                          │
├────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ ┌────────────┐ │
│ │                                         │ │ View       │ │
│ │                                         │ │ ○ Front    │ │
│ │                                         │ │ ○ Back     │ │
│ │           3D VIEWPORT                   │ │ ○ Left     │ │
│ │                                         │ │ ○ Right    │ │
│ │      (Orbit/Pan/Zoom controls)          │ │ ○ Top      │ │
│ │                                         │ │ ○ Bottom   │ │
│ │                                         │ │ ○ Iso      │ │
│ │                                         │ │            │ │
│ │                                         │ │ Display    │ │
│ │                                         │ │ ☑ Grid     │ │
│ │                                         │ │ ☐ Wireframe│ │
│ │                                         │ │ ☐ Axes     │ │
│ │                                         │ │            │ │
│ │                                         │ │ Background │ │
│ │                                         │ │ [■ #1a1a1a]│ │
│ └─────────────────────────────────────────┘ └────────────┘ │
├────────────────────────────────────────────────────────────┤
│  [Reset View]  [Fit to Screen]      [📷 Take Screenshot]   │
└────────────────────────────────────────────────────────────┘
```

### 1.4 Dependencies to Add

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

### 1.5 Implementation Steps

| Step | Task | Estimated Complexity |
|------|------|---------------------|
| 1 | Add type definitions for 3D models | Low |
| 2 | Install Three.js dependencies | Low |
| 3 | Create Model3DUploadPanel component | Medium |
| 4 | Create model loader utilities | Medium |
| 5 | Create Model3DViewerModal with basic rendering | High |
| 6 | Add orbit/pan/zoom controls | Medium |
| 7 | Implement view presets | Low |
| 8 | Implement screenshot capture | Medium |
| 9 | Add screenshot → canvas image flow | Medium |
| 10 | Add Electron IPC handlers for model storage | Medium |
| 11 | Update storage service for model registry | Medium |
| 12 | Add IFC loader support | High |
| 13 | Add canvas 3D model preview rendering | Medium |
| 14 | Add 3D badge indicator on canvas | Low |
| 15 | Testing & polish | Medium |

---

## Feature 2: Video Generation

### 2.1 User Flow

```
User composes prompt + optional reference images
    ↓
Select "Video" generation mode (instead of Image)
    ↓
Configure video parameters (duration, aspect ratio, etc.)
    ↓
Click Generate
    ↓
Video generation starts (may take longer than images)
    ↓
Progress indicator shows generation status
    ↓
Generated video appears on canvas (as thumbnail + play icon)
    ↓
Click to play in modal / Double-click to open video editor
    ↓
Video can be used as reference for further generations
```

### 2.2 Implementation Components

#### A. Type System Extensions

**File: `/types.ts`**

```typescript
// Video configuration
interface VideoConfig {
  duration: number;            // seconds (e.g., 5, 10, 15)
  aspectRatio: string;         // '16:9', '9:16', '1:1', '4:3'
  fps: number;                 // 24, 30, 60
  quality: 'standard' | 'high';
}

// Canvas video item
interface CanvasVideo {
  id: string;
  type: 'video';

  // Video file references
  videoPath?: string;          // Electron file path
  videoDataUri?: string;       // Base64 (small videos only)
  videoUrl?: string;           // URL for streaming

  // Thumbnail for canvas display
  thumbnailUri?: string;
  thumbnailPath?: string;

  // Canvas position & size
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;

  // Video metadata
  duration: number;            // seconds
  fps: number;
  fileSize: number;
  selected: boolean;

  // Generation info
  generationId?: string;
  prompt?: string;
}

// Generation type extension
interface Generation {
  id: string;
  type: 'image' | 'video';     // Add video type
  // ... existing fields
  videoConfig?: VideoConfig;
  outputVideos?: CanvasVideo[];
}
```

#### B. Video Parameters Panel

**Updates to: `/components/ParametersPanel.tsx`**

```typescript
// Add video-specific parameters
interface VideoParameters {
  generationType: 'image' | 'video';
  videoDuration: 5 | 10 | 15;      // seconds
  videoAspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  videoFps: 24 | 30;
  videoQuality: 'standard' | 'high';
}

// UI additions:
// - Toggle between Image/Video generation
// - Duration slider (5-15 seconds)
// - FPS selector
// - Quality selector
```

#### C. Video Generation Service

**New File: `/services/videoGenerationService.ts`**

```typescript
// Note: This depends on API availability
// Currently Gemini doesn't have public video generation API
// This is designed for when such API becomes available
// Or can be adapted for other video AI services

interface VideoGenerationRequest {
  prompt: string;
  referenceImages?: string[];    // Base64 images
  config: VideoConfig;
  apiKey: string;
}

interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;             // URL to generated video
  videoData?: string;            // Base64 video data
  thumbnailUrl?: string;
  duration: number;
  width: number;
  height: number;
  error?: string;
}

export const generateVideo = async (
  request: VideoGenerationRequest
): Promise<VideoGenerationResponse> => {
  // Implementation depends on available API
  // Options:
  // 1. Google Veo (when available)
  // 2. Runway Gen-3
  // 3. Pika Labs API
  // 4. Stable Video Diffusion

  // Placeholder for API integration
};

// Progress tracking (videos take longer)
export const pollVideoStatus = async (
  generationId: string
): Promise<{ status: string; progress: number }> => {
  // Poll generation status
  // Return progress percentage
};
```

#### D. Video Player Modal

**New File: `/components/VideoPlayerModal.tsx`**

```typescript
// Features:
// 1. Video playback
//    - Play/Pause
//    - Seek bar
//    - Volume control
//    - Fullscreen toggle
//
// 2. Frame extraction
//    - Pause video
//    - Click "Extract Frame" to save current frame as image
//    - Frame saved to canvas like 3D screenshot
//
// 3. Video info
//    - Duration, resolution, file size
//    - Generation prompt (if generated)
//
// 4. Export options
//    - Download as MP4
//    - Convert to GIF (for short clips)
```

#### E. Video Thumbnail Generation

**Updates to: `/utils/imageUtils.ts`**

```typescript
// Extract thumbnail from video file
export const generateVideoThumbnail = async (
  videoFile: File | string,      // File or data URI
  seekTime = 0                   // Seconds to seek for thumbnail
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, video.duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth, 512);
      canvas.height = Math.min(video.videoHeight, 512);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL('image/jpeg', 0.85));
      video.remove();
    };

    video.onerror = reject;

    if (typeof videoFile === 'string') {
      video.src = videoFile;
    } else {
      video.src = URL.createObjectURL(videoFile);
    }
  });
};
```

#### F. Canvas Video Rendering

**Updates to: `/components/MixboardView.tsx`**

```typescript
// Render video items on canvas
const renderVideoItem = (video: CanvasVideo) => {
  return (
    <div
      key={video.id}
      className="canvas-video-item"
      style={{
        position: 'absolute',
        left: video.x,
        top: video.y,
        width: video.width,
        height: video.height,
      }}
      onDoubleClick={() => openVideoPlayer(video)}
    >
      {/* Thumbnail */}
      <img src={video.thumbnailUri} alt="" />

      {/* Play button overlay */}
      <div className="video-play-overlay">
        <PlayCircle size={48} />
      </div>

      {/* Duration badge */}
      <div className="video-duration-badge">
        {formatDuration(video.duration)}
      </div>

      {/* Video icon indicator */}
      <div className="video-type-badge">
        <Video size={16} />
      </div>
    </div>
  );
};
```

#### G. Storage Extensions for Video

**Updates to: `/services/storageV2.ts`**

```typescript
// Video registry (similar to image/model registries)
// File: video_registry.json

interface VideoRegistryEntry {
  id: string;
  hash: string;
  originalName: string;
  mimeType: string;           // video/mp4, video/webm
  fileSize: number;
  filePath: string;
  thumbnailPath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  generationId?: string;
  createdAt: string;
}

// File storage structure:
// ~/Documents/ImageProvenanceStudio/users/{user}/
//   ├── videos/
//   │   ├── video_1733664000000_abc123.mp4
//   │   └── video_1733664100000_def456.webm
//   ├── video_thumbnails/
//   │   └── {sessionId}/
//   │       ├── video-001.jpg
//   │       └── video-002.jpg
//   └── video_registry.json
```

#### H. Video Upload Component

**New File: `/components/VideoUploadPanel.tsx`**

```typescript
// Features:
// - Drag-drop zone for video files
// - Supported formats: mp4, webm, mov
// - File size validation (warn for large files)
// - Auto-thumbnail generation
// - Duration display
// - Video preview on hover
```

### 2.3 UI/UX Design

#### Generation Mode Toggle
```
┌──────────────────────────────────────┐
│  Generation Mode                      │
│  ┌─────────┐ ┌─────────┐             │
│  │  Image  │ │  Video  │             │
│  │   📷    │ │   🎬    │             │
│  └─────────┘ └─────────┘             │
└──────────────────────────────────────┘
```

#### Video Parameters (when Video mode selected)
```
┌──────────────────────────────────────┐
│  Video Settings                       │
│                                       │
│  Duration:     [5s] [10s] [15s]       │
│  Aspect Ratio: [16:9 ▼]              │
│  Quality:      ○ Standard  ○ High    │
│                                       │
└──────────────────────────────────────┘
```

#### Canvas Video Display
```
┌────────────────────────┐
│  ┌──────────────────┐  │
│  │                  │  │
│  │    Thumbnail     │  │
│  │       ▶️         │  │ ← Play icon overlay
│  │                  │  │
│  └──────────────────┘  │
│  🎬 0:10               │ ← Video badge + duration
└────────────────────────┘
```

#### Video Player Modal
```
┌────────────────────────────────────────────────────────────┐
│  [×] Video Player - generated_video.mp4                    │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │                                                        │ │
│ │                                                        │ │
│ │                   VIDEO PLAYBACK                       │ │
│ │                                                        │ │
│ │                                                        │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│  ▶️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○ 0:05/0:10 │
│                                                            │
│  [🔊 Volume]                    [📷 Extract Frame] [⬇ Save]│
└────────────────────────────────────────────────────────────┘
```

### 2.4 API Integration Notes

**Current Status:**
- Gemini API (used by this app) does not yet have public video generation
- Google Veo is announced but API not publicly available

**Integration Options:**

1. **Google Veo (Recommended when available)**
   - Same API key and SDK patterns as Gemini
   - Seamless integration with existing code

2. **Runway Gen-3 Alpha**
   - REST API available
   - High quality output
   - Requires separate API key

3. **Pika Labs**
   - API access available
   - Good for motion effects

4. **Stable Video Diffusion**
   - Self-hosted or via Replicate
   - Open source option

**Suggested Approach:**
- Build the UI and infrastructure now
- Add placeholder/mock for video generation
- Implement real API when available
- Design to support multiple video APIs

### 2.5 Implementation Steps

| Step | Task | Estimated Complexity |
|------|------|---------------------|
| 1 | Add type definitions for video | Low |
| 2 | Add generation mode toggle to UI | Low |
| 3 | Create VideoUploadPanel component | Medium |
| 4 | Implement video thumbnail generation | Medium |
| 5 | Add video parameters to ParametersPanel | Medium |
| 6 | Create VideoPlayerModal component | High |
| 7 | Implement canvas video rendering | Medium |
| 8 | Add video to storage service | Medium |
| 9 | Add Electron IPC handlers for video | Medium |
| 10 | Create video generation service (stub) | Low |
| 11 | Implement frame extraction | Medium |
| 12 | Add video to GraphView nodes | Medium |
| 13 | Implement real API integration | High |
| 14 | Testing & polish | Medium |

---

## Implementation Priority

### Phase 1: Core Infrastructure
1. Type system extensions (both features)
2. Storage service updates
3. Electron IPC handlers

### Phase 2: 3D Model Feature
1. Install Three.js dependencies
2. Model upload panel
3. Model loaders (GLB/OBJ first, then IFC)
4. 3D Viewer Modal
5. Screenshot capture
6. Canvas integration

### Phase 3: Video Feature
1. Video upload panel
2. Video thumbnail generation
3. Video player modal
4. Canvas video rendering
5. Video generation service (stub)
6. Real API integration (when available)

### Phase 4: Polish & Integration
1. Cross-feature integration (video of 3D model rotation)
2. Performance optimization
3. Error handling
4. User documentation

---

## Technical Considerations

### Performance
- 3D models can be large; lazy load when entering edit mode
- Video files require streaming; don't load full video into memory
- Use Web Workers for heavy processing (IFC parsing, video encoding)

### File Size Limits
- GLB/OBJ: Recommend < 50MB for smooth performance
- IFC: Recommend < 100MB (complex architectural models)
- Video: Recommend < 500MB for canvas display

### Browser Compatibility
- Three.js requires WebGL 2.0 (all modern browsers)
- Video codecs: MP4/H.264 universally supported
- WebM/VP9 for better compression

### Electron-Specific
- Use native file dialogs for large file selection
- Store large files on disk, not in localStorage
- Stream videos from disk rather than loading into memory

---

## Future Enhancements

### 3D Models
- Animation playback for GLB models
- Material editing
- Measurement tools
- Section planes for IFC
- Multi-model comparison

### Video
- Video editing (trim, crop)
- Add audio
- Text overlays
- Transitions
- Export as GIF
- Video-to-video generation (style transfer)

---

## Appendix: File Structure After Implementation

```
/components/
├── Model3DUploadPanel.tsx      [NEW]
├── Model3DViewerModal.tsx      [NEW]
├── VideoUploadPanel.tsx        [NEW]
├── VideoPlayerModal.tsx        [NEW]
├── MixboardView.tsx            [UPDATED]
├── GraphView.tsx               [UPDATED]
├── ParametersPanel.tsx         [UPDATED]
└── ...

/services/
├── storageV2.ts                [UPDATED]
├── geminiService.ts            [UPDATED]
├── videoGenerationService.ts   [NEW]
└── ...

/utils/
├── imageUtils.ts               [UPDATED]
├── model3DLoaders.ts           [NEW]
└── ...

/types.ts                       [UPDATED]

/public/
├── draco/                      [NEW] (Draco decoder for compressed GLB)
└── wasm/                       [NEW] (IFC WASM files)
```
