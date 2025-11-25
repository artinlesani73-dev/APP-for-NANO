import { Session, SessionGeneration, ImageRole, GenerationConfig, GraphNode, GraphEdge, StoredImageMeta, UploadedImagePayload } from '../types';

// Detect Electron
const isElectron = () => {
  // @ts-ignore
  return typeof window.electron !== 'undefined';
};

const generateUUID = () => {
  return crypto.randomUUID();
};

// Generate filename for images with timestamp and ID
const generateImageFilename = (role: ImageRole, id: string): string => {
  const timestamp = Date.now();
  const ext = 'png';
  return `${role}_${timestamp}_${id}.${ext}`;
};

const stripDataUriHeader = (dataUri: string): string => dataUri.replace(/^data:image\/\w+;base64,/, '');

const estimateSizeFromBase64 = (dataUri: string): number => {
  const raw = stripDataUriHeader(dataUri);
  return Math.floor((raw.length * 3) / 4);
};

// Utility for hashing
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

const normalizeImagePayload = (payload: string | UploadedImagePayload): UploadedImagePayload => {
  if (typeof payload === 'string') return { data: payload };
  return payload;
};

const INPUT_LOG_KEY = 'input_image_log';

const ensureGraphState = (session: Session): Session => {
  if (!session.graph) {
    session.graph = { nodes: [], edges: [] };
  }
  return session;
};

export const StorageService = {
  isElectron: isElectron,

  // =======================
  // SESSION MANAGEMENT
  // =======================

  // Create a new session
  createSession: (title: string = "New Session"): Session => {
    const session: Session = {
      session_id: generateUUID(),
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      generations: [],
      graph: { nodes: [], edges: [] }
    };

    StorageService.saveSession(session);
    return session;
  },

  // Save session to storage
  saveSession: (session: Session) => {
    session.updated_at = new Date().toISOString();
    ensureGraphState(session);

    if (isElectron()) {
      // @ts-ignore
      window.electron.saveSessionSync(session.session_id, session);
    } else {
      // For web, store in localStorage
      localStorage.setItem(`session_${session.session_id}`, JSON.stringify(session));
    }
  },

  // Load session from storage
  loadSession: (sessionId: string): Session | null => {
    if (isElectron()) {
      // @ts-ignore
      const loaded = window.electron.loadSessionSync(sessionId);
      return loaded ? ensureGraphState(loaded) : null;
    } else {
      const data = localStorage.getItem(`session_${sessionId}`);
      return data ? ensureGraphState(JSON.parse(data)) : null;
    }
  },

  // Get all sessions
  getSessions: (): Session[] => {
    if (isElectron()) {
      // @ts-ignore
      const sessions = window.electron.listSessionsSync();
      sessions.forEach((session: Session) => ensureGraphState(session));
      return sessions.sort((a: Session, b: Session) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      const sessions: Session[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('session_')) {
          const data = localStorage.getItem(key);
          if (data) sessions.push(ensureGraphState(JSON.parse(data)));
        }
      }
      return sessions.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
  },

  // Rename a session
  renameSession: (sessionId: string, newTitle: string) => {
    const session = StorageService.loadSession(sessionId);
    if (session) {
      session.title = newTitle;
      StorageService.saveSession(session);
    }
  },

  // Delete a session
  deleteSession: (sessionId: string) => {
    if (isElectron()) {
      // @ts-ignore
      window.electron.deleteSessionSync(sessionId);
    } else {
      localStorage.removeItem(`session_${sessionId}`);
    }
  },

  // Persist graph state for a session
  updateSessionGraph: (sessionId: string, nodes: GraphNode[], edges: GraphEdge[]) => {
    const session = StorageService.loadSession(sessionId);
    if (!session) return;

    session.graph = { nodes, edges };
    StorageService.saveSession(session);
  },

  // =======================
  // IMAGE MANAGEMENT
  // =======================

  // Save image to file system (Electron) or localStorage (web)
  saveImage: (image: string | UploadedImagePayload, role: ImageRole): StoredImageMeta => {
    const payload = normalizeImagePayload(image);
    const id = generateUUID();
    const filename = generateImageFilename(role, id);
    const base64Data = payload.data;
    const estimatedSize = payload.size_bytes ?? estimateSizeFromBase64(base64Data);
    const originalName = payload.original_name || `${role}_image.png`;

    if (isElectron()) {
      if (role === 'output') {
        // Save outputs as before
        // @ts-ignore
        const result = window.electron.saveImageSync('outputs', filename, base64Data);
        if (!result.success) {
          throw new Error(`Failed to save image: ${result.error}`);
        }
        return { id, filename, hash: simpleHash(stripDataUriHeader(base64Data)), size_bytes: estimatedSize, original_name: originalName };
      }

      // Input images: deduplicate by name and size using shared log
      // @ts-ignore
      const result = window.electron.saveInputImageSync(originalName, estimatedSize, base64Data);
      if (!result.success) {
        throw new Error(`Failed to save image: ${result.error}`);
      }
      return {
        id: result.id,
        filename: result.filename,
        hash: result.hash,
        original_name: result.original_name,
        size_bytes: result.size_bytes,
      };
    }

    // Web fallback with localStorage log for deduplication
    const logRaw = localStorage.getItem(INPUT_LOG_KEY);
    const log: StoredImageMeta[] = logRaw ? JSON.parse(logRaw) : [];
    if (role !== 'output') {
      const existing = log.find(entry => entry.original_name === originalName && entry.size_bytes === estimatedSize);
      if (existing) {
        const existingData = localStorage.getItem(`image_${existing.id}`);
        if (!existingData) {
          localStorage.setItem(`image_${existing.id}`, base64Data);
        }
        return existing;
      }
    }

    const hash = simpleHash(stripDataUriHeader(base64Data));
    const suffix = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '.png';
    const baseName = originalName.replace(suffix, '');
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '') || role;
    const finalFilename = `${sanitizedBase}_${id}${suffix}`;

    localStorage.setItem(`image_${id}`, base64Data);

    const record: StoredImageMeta = {
      id,
      filename: finalFilename,
      hash,
      original_name: originalName,
      size_bytes: estimatedSize,
    };

    if (role !== 'output') {
      log.push(record);
      localStorage.setItem(INPUT_LOG_KEY, JSON.stringify(log));
    }

    return record;
  },

  // Load image from file system or localStorage
  loadImage: (role: ImageRole, id: string, filename: string): string | null => {
    if (isElectron()) {
      // @ts-ignore
      const folder = role === 'output' ? 'outputs' : 'inputs';
      // @ts-ignore
      return window.electron.loadImageSync(folder, filename);
    } else {
      return localStorage.getItem(`image_${id}`);
    }
  },

  // Export a single output image
  exportImage: (filename: string, role: ImageRole = 'output') => {
    if (isElectron()) {
      // In Electron, this will trigger a save dialog
      // @ts-ignore
      const result = window.electron.exportImageSync(role + 's', filename);
      return result.success;
    } else {
      // For web, download the image
      const match = filename.match(/^(\w+)_\d+_([a-f0-9-]+)\.png$/);
      if (!match) return false;

      const id = match[2];
      const dataUrl = localStorage.getItem(`image_${id}`);
      if (!dataUrl) return false;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  },

  // =======================
  // GENERATION MANAGEMENT
  // =======================

  // Create a new generation in a session
  createGeneration: (
    sessionId: string,
    prompt: string,
    config: GenerationConfig,
    controlImagesData?: UploadedImagePayload[],
    referenceImagesData?: UploadedImagePayload[]
  ): SessionGeneration => {
    const generation: SessionGeneration = {
      generation_id: generateUUID(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      prompt,
      parameters: config
    };

    // Save control images if provided
    if (controlImagesData && controlImagesData.length > 0) {
      generation.control_images = controlImagesData.map(data =>
        StorageService.saveImage(data, 'control')
      );
    }

    // Save reference images if provided
    if (referenceImagesData && referenceImagesData.length > 0) {
      generation.reference_images = referenceImagesData.map(data =>
        StorageService.saveImage(data, 'reference')
      );
    }

    // Add generation to session
    const session = StorageService.loadSession(sessionId);
    if (session) {
      session.generations.push(generation);
      StorageService.saveSession(session);
    }

    return generation;
  },

  // Complete a generation with output
  completeGeneration: (
    sessionId: string,
    generationId: string,
    outputImageData: string | string[] | null,
    timeMs: number,
    outputTextData?: string | string[]
  ) => {
    const session = StorageService.loadSession(sessionId);
    if (!session) return;

    const generation = session.generations.find(g => g.generation_id === generationId);
    if (!generation) return;

    const imageDataList = outputImageData === null
      ? []
      : Array.isArray(outputImageData)
        ? outputImageData
        : [outputImageData];

    const imageInfos = imageDataList.map(image => StorageService.saveImage(image, 'output'));

    if (imageInfos.length > 0) {
      generation.output_image = imageInfos[0];
      generation.output_images = imageInfos;
    }

    if (outputTextData) {
      generation.output_texts = Array.isArray(outputTextData) ? outputTextData : [outputTextData];
    }
    generation.generation_time_ms = timeMs;
    generation.status = 'completed';

    StorageService.saveSession(session);
  },

  // Mark generation as failed
  failGeneration: (sessionId: string, generationId: string, error: string) => {
    const session = StorageService.loadSession(sessionId);
    if (!session) return;

    const generation = session.generations.find(g => g.generation_id === generationId);
    if (!generation) return;

    generation.status = 'failed';
    generation.error = error;

    StorageService.saveSession(session);
  },

  // Get specific generation from session
  getGeneration: (sessionId: string, generationId: string): SessionGeneration | null => {
    const session = StorageService.loadSession(sessionId);
    if (!session) return null;

    return session.generations.find(g => g.generation_id === generationId) || null;
  },

  // =======================
  // EXPORT / IMPORT
  // =======================

  exportData: (): string => {
    if (isElectron()) {
      // Export all sessions
      const sessions = StorageService.getSessions();
      return JSON.stringify({ sessions }, null, 2);
    } else {
      // Export from localStorage
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('session_') || key.startsWith('image_'))) {
          data[key] = localStorage.getItem(key);
        }
      }
      return JSON.stringify(data, null, 2);
    }
  },

  importData: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);

      if (isElectron()) {
        // Import sessions
        if (data.sessions && Array.isArray(data.sessions)) {
          data.sessions.forEach((session: Session) => {
            StorageService.saveSession(session);
          });
        }
      } else {
        // Clear existing data
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('session_') || key.startsWith('image_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Import new data
        Object.keys(data).forEach(key => {
          if (key.startsWith('session_') || key.startsWith('image_')) {
            localStorage.setItem(key, data[key]);
          }
        });
      }

      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};
