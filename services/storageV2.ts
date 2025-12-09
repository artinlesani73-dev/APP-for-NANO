/**
 * Storage Service V2
 *
 * New architecture for desktop-only app with MixboardSession:
 * 1. {sessionId}_generations.json - Generation history
 * 2. {sessionId}_canvas.json - Canvas state with refs to assets
 * 3. image_registry.json - Global image registry (session-agnostic)
 * 4. logs.jsonl - Append-only logs
 *
 * Images stored as: images/{role}_{timestamp}_{id}.png
 * Thumbnails: thumbnails/{sessionId}/{imageId}.png
 */

import { MixboardSession, MixboardGeneration, CanvasImage, StoredImageMeta, GenerationConfig } from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Global image registry entry (session-agnostic)
 */
export interface ImageRegistryEntry {
  id: string;              // Unique UUID
  hash: string;            // Content hash (for deduplication)
  original_name?: string;  // Original filename
  imported_at: string;     // ISO timestamp of first import
  size_bytes: number;      // File size
  width: number;           // Image dimensions
  height: number;
  mime_type: string;       // e.g., 'image/png'
  file_path: string;       // Relative path: images/{role}_{timestamp}_{id}.png
}

/**
 * Image registry structure
 */
export interface ImageRegistry {
  version: string;
  images: Record<string, ImageRegistryEntry>; // Key: hash
}

/**
 * Generation data (stored per session)
 */
export interface GenerationsData {
  version: string;
  session_id: string;
  generations: MixboardGeneration[];
}

/**
 * Canvas state (stored per session)
 */
export interface CanvasStateData {
  version: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  canvas_images: Array<{
    canvasId: string;        // Canvas-specific ID
    imageHash: string;       // Reference to image_registry
    type?: 'image' | 'text' | 'board';
    text?: string;           // For text entities
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    fontFamily?: string;
    backgroundColor?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    originalWidth: number;
    originalHeight: number;
    generationId?: string;   // Parent generation ID
    thumbnailPath?: string;  // Path to thumbnail file
  }>;
  zoom: number;
  panOffset: { x: number; y: number };
  user?: {
    displayName: string;
    id: string;
  };
}

/**
 * Session metadata (lightweight, for listing)
 */
export interface SessionMetadata {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user?: {
    displayName: string;
    id: string;
  };
  generation_count: number;
  canvas_image_count: number;
}

/**
 * Log entry for JSONL format
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'action';
  user?: string;
  userId?: string;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const isElectron = (): boolean => {
  // @ts-ignore
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined';
};

const generateUUID = (): string => {
  return crypto.randomUUID();
};

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

const stripDataUriHeader = (dataUri: string): string => {
  return dataUri.replace(/^data:image\/\w+;base64,/, '');
};

const getMimeTypeFromDataUri = (dataUri: string): string => {
  const match = dataUri.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/png';
};

// ============================================================================
// STORAGE SERVICE V2
// ============================================================================

export const StorageServiceV2 = {

  // --------------------------------------------------------------------------
  // IMAGE REGISTRY (Global, session-agnostic)
  // --------------------------------------------------------------------------

  /**
   * Load the global image registry
   */
  loadImageRegistry: (): ImageRegistry => {
    if (!isElectron()) {
      throw new Error('StorageV2 is desktop-only');
    }

    try {
      // @ts-ignore
      const data = window.electron.loadSync('image_registry.json');
      if (!data) {
        return { version: '2.0', images: {} };
      }
      return JSON.parse(data);
    } catch (err) {
      console.warn('Failed to load image registry, creating new one');
      return { version: '2.0', images: {} };
    }
  },

  /**
   * Save the global image registry
   */
  saveImageRegistry: (registry: ImageRegistry): void => {
    if (!isElectron()) return;

    registry.version = '2.0';
    // @ts-ignore
    window.electron.saveSync('image_registry.json', JSON.stringify(registry, null, 2));
  },

  /**
   * Register an image in the global registry (with deduplication)
   * Returns the hash that should be used to reference this image
   * Note: role 'control' and 'reference' both result in 'input_' prefix
   */
  registerImage: (dataUri: string, originalName?: string, role: 'control' | 'reference' | 'output' = 'reference'): { hash: string; entry: ImageRegistryEntry } => {
    const registry = StorageServiceV2.loadImageRegistry();

    // Calculate hash from image content
    const hash = simpleHash(stripDataUriHeader(dataUri));

    // Check if image already exists
    if (registry.images[hash]) {
      console.log('[StorageV2] Image already registered:', hash);
      return { hash, entry: registry.images[hash] };
    }

    // Create new entry
    const id = generateUUID();
    const timestamp = Date.now();
    // Use 'input' prefix for all non-output images (control/reference → input)
    const filePrefix = role === 'output' ? 'output' : 'input';
    const filename = `${filePrefix}_${timestamp}_${id}.png`;
    const filePath = `images/${filename}`;

    // Get image dimensions
    const img = new Image();
    img.src = dataUri;

    const entry: ImageRegistryEntry = {
      id,
      hash,
      original_name: originalName,
      imported_at: new Date().toISOString(),
      size_bytes: Math.floor((stripDataUriHeader(dataUri).length * 3) / 4),
      width: 0, // Will be set after image loads
      height: 0,
      mime_type: getMimeTypeFromDataUri(dataUri),
      file_path: filePath
    };

    // Save image file
    // @ts-ignore
    window.electron.saveImageSync('images', filename, stripDataUriHeader(dataUri));

    // Add to registry
    registry.images[hash] = entry;
    StorageServiceV2.saveImageRegistry(registry);

    console.log('[StorageV2] Registered new image:', hash, filePath);
    return { hash, entry };
  },

  /**
   * Get image entry from registry by hash
   */
  getImageByHash: (hash: string): ImageRegistryEntry | null => {
    const registry = StorageServiceV2.loadImageRegistry();
    return registry.images[hash] || null;
  },

  /**
   * Load image data URI by hash
   */
  loadImageByHash: (hash: string): string | null => {
    const entry = StorageServiceV2.getImageByHash(hash);
    if (!entry) return null;

    try {
      const filename = entry.file_path.split('/').pop();
      if (!filename) return null;

      // @ts-ignore
      const base64 = window.electron.loadImageSync('images', filename);
      if (!base64) return null;

      return `data:${entry.mime_type};base64,${base64}`;
    } catch (err) {
      return null;
    }
  },

  /**
   * Load thumbnail by path
   * Used for History and Graph views to display lightweight thumbnails
   */
  loadThumbnailByPath: (thumbnailPath: string): string | null => {
    if (!isElectron()) return null;
    if (!thumbnailPath) return null;

    try {
      // thumbnailPath format: "thumbnails/{session_id}/{imageId}.png"
      // Use loadThumbnailSync which returns a properly formatted data URI
      // @ts-ignore
      const thumbnailUri = window.electron.loadThumbnailSync(thumbnailPath);
      return thumbnailUri || null;
    } catch (err) {
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create a new Mixboard session
   */
  createSession: (title: string, user?: { displayName: string; id: string }): MixboardSession => {
    const sessionId = `mixboard-${Date.now()}`;
    const now = new Date().toISOString();

    const session: MixboardSession = {
      session_id: sessionId,
      title,
      created_at: now,
      updated_at: now,
      generations: [],
      canvas_images: [],
      user
    };

    // Save empty generations and canvas files
    StorageServiceV2.saveGenerations(sessionId, []);
    StorageServiceV2.saveCanvasState(sessionId, {
      version: '2.0',
      session_id: sessionId,
      title,
      created_at: now,
      updated_at: now,
      canvas_images: [],
      zoom: 1.0,
      panOffset: { x: 0, y: 0 },
      user
    });

    return session;
  },

  /**
   * Save generations data for a session
   */
  saveGenerations: (sessionId: string, generations: MixboardGeneration[]): void => {
    if (!isElectron()) return;

    const data: GenerationsData = {
      version: '2.0',
      session_id: sessionId,
      generations
    };

    const filename = `${sessionId}_generations.json`;
    // @ts-ignore
    window.electron.saveSync(`sessions/${filename}`, JSON.stringify(data, null, 2));
  },

  /**
   * Load generations data for a session
   */
  loadGenerations: (sessionId: string): MixboardGeneration[] => {
    if (!isElectron()) return [];

    try {
      const filename = `${sessionId}_generations.json`;
      // @ts-ignore
      const content = window.electron.loadSync(`sessions/${filename}`);
      if (!content) return [];

      const data: GenerationsData = JSON.parse(content);
      return data.generations || [];
    } catch (err) {
      console.warn('[StorageV2] Failed to load generations:', sessionId);
      return [];
    }
  },

  /**
   * Save canvas state for a session
   */
  saveCanvasState: (sessionId: string, canvasState: CanvasStateData): void => {
    if (!isElectron()) return;

    canvasState.version = '2.0';
    canvasState.updated_at = new Date().toISOString();

    const filename = `${sessionId}_canvas.json`;
    // @ts-ignore
    window.electron.saveSync(`sessions/${filename}`, JSON.stringify(canvasState, null, 2));
  },

  /**
   * Load canvas state for a session
   */
  loadCanvasState: (sessionId: string): CanvasStateData | null => {
    if (!isElectron()) return null;

    try {
      const filename = `${sessionId}_canvas.json`;
      // @ts-ignore
      const content = window.electron.loadSync(`sessions/${filename}`);
      if (!content) return null;

      return JSON.parse(content);
    } catch (err) {
      console.warn('[StorageV2] Failed to load canvas state:', sessionId);
      return null;
    }
  },

  /**
   * Load a complete Mixboard session (combines generations + canvas)
   */
  loadSession: (sessionId: string): MixboardSession | null => {
    const canvasState = StorageServiceV2.loadCanvasState(sessionId);
    if (!canvasState) return null;

    const generations = StorageServiceV2.loadGenerations(sessionId);
    const registry = StorageServiceV2.loadImageRegistry();

    // Reconstruct canvas images with full data URIs
    const canvasImages: CanvasImage[] = canvasState.canvas_images.map(img => {
      const registryEntry = registry.images[img.imageHash];
      const dataUri = registryEntry ? StorageServiceV2.loadImageByHash(img.imageHash) : null;

      return {
        id: img.canvasId,
        type: img.type,
        dataUri: dataUri || undefined,
        text: img.text,
        fontSize: img.fontSize,
        fontWeight: img.fontWeight,
        fontStyle: img.fontStyle,
        fontFamily: img.fontFamily,
        backgroundColor: img.backgroundColor,
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        selected: img.selected,
        originalWidth: img.originalWidth,
        originalHeight: img.originalHeight,
        generationId: img.generationId,
        thumbnailPath: img.thumbnailPath,
        imageMetaId: img.imageHash // Store hash as meta ID for compatibility
      };
    });

    return {
      session_id: sessionId,
      title: canvasState.title,
      created_at: canvasState.created_at,
      updated_at: canvasState.updated_at,
      generations,
      canvas_images: canvasImages,
      user: canvasState.user
    };
  },

  /**
   * Save a complete Mixboard session (splits into generations + canvas)
   */
  saveSession: (session: MixboardSession): void => {
    const registry = StorageServiceV2.loadImageRegistry();

    // Process canvas images: register new images and create refs
    const canvasStateImages = session.canvas_images.map(img => {
      let imageHash = img.imageMetaId || ''; // Try to reuse existing hash

      // If it's an image with dataUri and no hash, register it
      if ((!img.type || img.type === 'image') && img.dataUri && !imageHash) {
        const { hash } = StorageServiceV2.registerImage(img.dataUri, undefined, 'reference');
        imageHash = hash;
      }

      // For existing images, verify hash exists in registry
      if (imageHash && !registry.images[imageHash] && img.dataUri) {
        const { hash } = StorageServiceV2.registerImage(img.dataUri, undefined, 'reference');
        imageHash = hash;
      }

      return {
        canvasId: img.id,
        imageHash,
        type: img.type,
        text: img.text,
        fontSize: img.fontSize,
        fontWeight: img.fontWeight,
        fontStyle: img.fontStyle,
        fontFamily: img.fontFamily,
        backgroundColor: img.backgroundColor,
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        selected: img.selected,
        originalWidth: img.originalWidth,
        originalHeight: img.originalHeight,
        generationId: img.generationId,
        thumbnailPath: img.thumbnailPath
      };
    });

    // Save canvas state
    const canvasState: CanvasStateData = {
      version: '2.0',
      session_id: session.session_id,
      title: session.title,
      created_at: session.created_at,
      updated_at: new Date().toISOString(),
      canvas_images: canvasStateImages,
      zoom: 1.0, // TODO: Store zoom/pan in session
      panOffset: { x: 0, y: 0 },
      user: session.user
    };

    StorageServiceV2.saveCanvasState(session.session_id, canvasState);
    StorageServiceV2.saveGenerations(session.session_id, session.generations);
  },

  /**
   * List all sessions (returns metadata only)
   */
  listSessions: (): SessionMetadata[] => {
    if (!isElectron()) return [];

    try {
      // @ts-ignore
      const files: string[] = window.electron.listFilesSync('sessions/');

      // Filter for canvas files only (one per session)
      // Handle both correct (_canvas.json) and old double-extension (_canvas.json.json) files
      const canvasFiles = files.filter(f =>
        f.endsWith('_canvas.json') || f.endsWith('_canvas.json.json')
      );

      const metadata: SessionMetadata[] = [];

      for (const file of canvasFiles) {
        try {
          // @ts-ignore
          const content: string | null = window.electron.loadSync(`sessions/${file}`);
          if (!content) continue;
          const canvasState: CanvasStateData = JSON.parse(content as string);

          // Load generation count
          // Handle both old double-extension and new correct filenames
          const generationFile = file.includes('.json.json')
            ? file.replace('_canvas.json.json', '_generations.json.json')
            : file.replace('_canvas.json', '_generations.json');
          let generationCount = 0;
          try {
            // @ts-ignore
            const genContent: string | null = window.electron.loadSync(`sessions/${generationFile}`);
            if (genContent) {
              const genData: GenerationsData = JSON.parse(genContent as string);
              generationCount = genData.generations.length;
            }
          } catch (e) {
            // Ignore
          }

          metadata.push({
            session_id: canvasState.session_id,
            title: canvasState.title,
            created_at: canvasState.created_at,
            updated_at: canvasState.updated_at,
            user: canvasState.user,
            generation_count: generationCount,
            canvas_image_count: canvasState.canvas_images.length
          });
        } catch (err) {
          // Ignore parse errors
        }
      }

      // Sort by updated_at (newest first)
      return metadata.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } catch (err) {
      return [];
    }
  },

  /**
   * Delete a session (removes both files)
   */
  deleteSession: (sessionId: string): void => {
    if (!isElectron()) return;

    try {
      // @ts-ignore
      window.electron.deleteSync(`sessions/${sessionId}_generations.json`);
      // @ts-ignore
      window.electron.deleteSync(`sessions/${sessionId}_canvas.json`);

      console.log('[StorageV2] Deleted session:', sessionId);
    } catch (err) {
      console.error('[StorageV2] Failed to delete session:', sessionId, err);
    }
  },

  /**
   * Rename a session
   */
  renameSession: (sessionId: string, newTitle: string): void => {
    const canvasState = StorageServiceV2.loadCanvasState(sessionId);
    if (!canvasState) return;

    canvasState.title = newTitle;
    StorageServiceV2.saveCanvasState(sessionId, canvasState);
  },

  // --------------------------------------------------------------------------
  // APPEND-ONLY LOGGING (JSONL)
  // --------------------------------------------------------------------------

  /**
   * Append a log entry to logs.jsonl
   */
  appendLog: (entry: Omit<LogEntry, 'timestamp'>): void => {
    if (!isElectron()) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    const line = JSON.stringify(logEntry) + '\n';

    try {
      // @ts-ignore
      window.electron.appendLog(line);
    } catch (err) {
      console.error('[StorageV2] Failed to append log:', err);
    }
  },

  /**
   * Read logs from logs.jsonl
   */
  readLogs: (limit?: number): LogEntry[] => {
    if (!isElectron()) return [];

    try {
      // @ts-ignore
      const content = window.electron.loadSync('logs.jsonl');
      if (!content) return [];

      const lines = content.trim().split('\n');
      const entries: LogEntry[] = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch (err) {
          console.warn('[StorageV2] Failed to parse log line:', line);
        }
      }

      // Return newest first, with optional limit
      entries.reverse();
      return limit ? entries.slice(0, limit) : entries;
    } catch (err) {
      console.error('[StorageV2] Failed to read logs:', err);
      return [];
    }
  },

  // --------------------------------------------------------------------------
  // THUMBNAILS
  // --------------------------------------------------------------------------

  /**
   * Save thumbnail for canvas image
   */
  saveThumbnail: (sessionId: string, imageId: string, thumbnailDataUri: string): string => {
    if (!isElectron()) return thumbnailDataUri;

    try {
      const thumbnailPath = `${sessionId}/${imageId}`;
      // @ts-ignore
      window.electron.saveThumbnailSync(sessionId, imageId, stripDataUriHeader(thumbnailDataUri));
      return `thumbnails/${thumbnailPath}.png`;
    } catch (err) {
      console.error('[StorageV2] Failed to save thumbnail:', err);
      return thumbnailDataUri;
    }
  },

  /**
   * Load thumbnail by path
   */
  loadThumbnail: (thumbnailPath: string): string | null => {
    if (!isElectron()) return null;

    try {
      // @ts-ignore
      const base64 = window.electron.loadThumbnailSync(thumbnailPath);
      if (!base64) return null;

      return `data:image/png;base64,${base64}`;
    } catch (err) {
      console.error('[StorageV2] Failed to load thumbnail:', err);
      return null;
    }
  },

  /**
   * Check if running in Electron environment
   */
  isElectron: (): boolean => {
    return isElectron();
  }
};
