/**
 * @deprecated Use MixboardSession instead for new implementations.
 * Legacy session format with separate control/reference images.
 */
export interface Session {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  generations: SessionGeneration[];
  graph?: GraphState;
  user?: {
    displayName: string;
    id: string;
  };
}

// Generation data embedded in session (not separated)
export interface StoredImageMeta {
  id: string;
  filename: string;
  hash?: string;
  original_name?: string;
  size_bytes?: number;
  thumbnailPath?: string;  // Path to thumbnail file for history/graph display
}

export interface UploadedImagePayload {
  data: string;
  original_name?: string;
  size_bytes?: number;
  id?: string;
  hash?: string;
}

/**
 * @deprecated Use MixboardGeneration instead for new implementations.
 * Legacy generation format with separate control/reference images.
 */
export interface SessionGeneration {
  generation_id: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';

  // Inputs
  prompt: string;
  control_images?: StoredImageMeta[];
  reference_images?: StoredImageMeta[];

  // Parameters
  parameters: GenerationConfig;

  // Outputs
  output_image?: StoredImageMeta;
  output_images?: StoredImageMeta[];
  output_texts?: string[];
  generation_time_ms?: number;
  error?: string;
}

// Legacy Chat interface (for backwards compatibility)
export interface Chat {
  chat_id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  generation_ids: string[];
}

export interface Prompt {
  prompt_id: string;
  prompt_hash: string;
  text: string;
  created_at: string;
  used_count: number;
}

export type ImageRole = 'control' | 'reference' | 'output';

export interface ImageRecord {
  image_id: string;
  image_hash: string;
  role: ImageRole;
  data_uri: string; // Storing base64 directly for this local-first demo
  created_at: string;
  metadata: {
    width: number;
    height: number;
    size_bytes: number;
    mime_type: string;
  };
}

export interface GenerationConfig {
  temperature: number;
  top_p: number;
  aspect_ratio: string;
  image_size: string;
  safety_filter: string;
  model: string;
}

export interface GraphNode {
  id: string;
  generationId?: string;
  type: 'prompt' | 'workflow' | 'control-image' | 'reference-image' | 'output-image' | 'output-text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: any;
  isStandalone?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  toHandle?: 'prompt' | 'control' | 'reference';
  color: string;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Generation {
  generation_id: string;
  chat_id: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  inputs: {
    prompt_hash: string;
    control_image_hash?: string | null;
    reference_image_hash?: string | null;
  };
  parameters: GenerationConfig;
  outputs?: {
    image_hash: string;
    generation_time_ms: number;
  };
  error?: string;
}

export interface Relationship {
  relationship_id: string;
  generation_id: string;
  nodes: {
    prompt: string; // hash
    control_image?: string; // hash
    reference_image?: string; // hash
    output_image?: string; // hash
  };
  graph: {
    from: string;
    to: string;
    type: 'generates' | 'controls' | 'references';
  }[];
}

// UI State Types
export interface AppState {
  currentChatId: string | null;
  chats: Chat[];
  activeGeneration: Generation | null;
}

export type LogEventType = 'login' | 'action' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  userId?: string;
  type: LogEventType;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// MIXBOARD TYPES (New unified format)
// ============================================================================

/**
 * Canvas image representation in Mixboard.
 * Tracks position, size, and relationship to generations.
 */
export interface CanvasImage {
  id: string;                      // Unique canvas image ID
  type?: 'image' | 'text' | 'board'; // Entity type (default: 'image')
  dataUri?: string;                // Base64 image data (for images) - full resolution
  thumbnailUri?: string;           // Base64 thumbnail data (for canvas display) - loaded from disk
  thumbnailPath?: string;          // Path to thumbnail file on disk (for Electron storage)
  text?: string;                   // Text content (for text entities)
  fontSize?: number;               // Font size (for text)
  fontWeight?: 'normal' | 'bold';  // Font weight (for text)
  fontStyle?: 'normal' | 'italic'; // Font style (for text)
  fontFamily?: string;             // Font family (for text)
  backgroundColor?: string;        // Background color (for board entities)
  tag?: 'control' | 'reference';   // User-assigned tag for images
  x: number;                       // Canvas X position
  y: number;                       // Canvas Y position
  width: number;                   // Display width
  height: number;                  // Display height
  selected: boolean;               // Selection state
  originalWidth: number;           // Original image width / text box width
  originalHeight: number;          // Original image height / text box height
  generationId?: string;           // Parent generation ID (if generated)
  imageMetaId?: string;            // Link to StoredImageMeta for persistence
}

/**
 * Mixboard generation format with unified image inputs.
 * Removes artificial control/reference distinction.
 */
export interface MixboardGeneration {
  generation_id: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';

  // Inputs
  prompt: string;
  input_images: StoredImageMeta[];   // UNIFIED: No control/reference split

  // Parameters
  parameters: GenerationConfig;

  // Outputs
  output_images: StoredImageMeta[];
  output_texts?: string[];
  generation_time_ms?: number;
  error_message?: string;

  // Canvas state preservation
  canvas_state?: {
    images: CanvasImage[];           // All images at generation time
    zoom: number;                    // Canvas zoom level
    panOffset: { x: number; y: number };  // Pan position
  };

  // Lineage tracking for graph view
  parent_generation_ids?: string[];  // IDs of generations that created input images
}

/**
 * Mixboard session format.
 * Represents a complete creative session with canvas state.
 */
export interface MixboardSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  generations: MixboardGeneration[];
  canvas_images: CanvasImage[];      // Current canvas state
  user?: {
    displayName: string;
    id: string;
  };
  graph?: GraphState;                // Optional graph state
}

// Type alias for ImageMeta (used throughout the codebase)
export type ImageMeta = StoredImageMeta;

// ============================================================================
// 3D MODEL TYPES
// ============================================================================

/**
 * Supported 3D model file types
 */
export type Model3DType = 'ifc' | 'glb' | 'gltf' | 'obj';

/**
 * 3D model canvas item representation.
 * Tracks position, size, and 3D-specific metadata.
 */
export interface Canvas3DModel {
  id: string;
  type: '3d-model';
  modelType: Model3DType;

  // File references
  modelPath?: string;           // Electron file path
  modelDataUri?: string;        // Base64 for web (GLB/OBJ only, IFC too large)

  // Canvas display
  thumbnailUri?: string;        // Preview image for canvas
  thumbnailPath?: string;       // Disk reference for thumbnail

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

  // Model info
  vertexCount?: number;
  faceCount?: number;
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * 3D model registry entry for storage
 */
export interface Model3DRegistryEntry {
  id: string;
  hash: string;              // SHA256 of model file
  originalName: string;
  modelType: Model3DType;
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

// ============================================================================
// VIDEO TYPES
// ============================================================================

/**
 * Video configuration for generation
 */
export interface VideoConfig {
  duration: number;            // seconds (e.g., 5, 10, 15)
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  fps: 24 | 30 | 60;
  quality: 'standard' | 'high';
}

/**
 * Canvas video item representation.
 * Tracks position, size, and video-specific metadata.
 */
export interface CanvasVideo {
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
  fileName: string;
  mimeType: string;            // video/mp4, video/webm
  selected: boolean;

  // Generation info (if AI-generated)
  generationId?: string;
  prompt?: string;
  videoConfig?: VideoConfig;
}

/**
 * Video registry entry for storage
 */
export interface VideoRegistryEntry {
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

/**
 * Video generation request
 */
export interface VideoGenerationRequest {
  prompt: string;
  referenceImages?: string[];    // Base64 images
  config: VideoConfig;
}

/**
 * Video generation response
 */
export interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;             // URL to generated video
  videoData?: string;            // Base64 video data
  thumbnailUrl?: string;
  duration: number;
  width: number;
  height: number;
  error?: string;
}

// ============================================================================
// UNIFIED CANVAS ITEM TYPE
// ============================================================================

/**
 * Union type for all canvas items (images, text, boards, 3D models, videos)
 */
export type CanvasItem = CanvasImage | Canvas3DModel | CanvasVideo;

/**
 * Type guard for CanvasImage
 */
export function isCanvasImage(item: CanvasItem): item is CanvasImage {
  return !item.type || item.type === 'image' || item.type === 'text' || item.type === 'board';
}

/**
 * Type guard for Canvas3DModel
 */
export function isCanvas3DModel(item: CanvasItem): item is Canvas3DModel {
  return item.type === '3d-model';
}

/**
 * Type guard for CanvasVideo
 */
export function isCanvasVideo(item: CanvasItem): item is CanvasVideo {
  return item.type === 'video';
}

// ============================================================================
// EXTENDED GENERATION CONFIG FOR VIDEO
// ============================================================================

/**
 * Extended generation config that supports both image and video generation
 */
export interface ExtendedGenerationConfig extends GenerationConfig {
  generationType?: 'image' | 'video';
  videoConfig?: VideoConfig;
}
