import { Session, SessionGeneration, ImageRole, GenerationConfig } from '../types';

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
      generations: []
    };

    StorageService.saveSession(session);
    return session;
  },

  // Save session to storage
  saveSession: (session: Session) => {
    session.updated_at = new Date().toISOString();

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
      return window.electron.loadSessionSync(sessionId);
    } else {
      const data = localStorage.getItem(`session_${sessionId}`);
      return data ? JSON.parse(data) : null;
    }
  },

  // Get all sessions
  getSessions: (): Session[] => {
    if (isElectron()) {
      // @ts-ignore
      const sessions = window.electron.listSessionsSync();
      return sessions.sort((a: Session, b: Session) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      const sessions: Session[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('session_')) {
          const data = localStorage.getItem(key);
          if (data) sessions.push(JSON.parse(data));
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

  // =======================
  // IMAGE MANAGEMENT
  // =======================

  // Save image to file system (Electron) or localStorage (web)
  saveImage: (base64Data: string, role: ImageRole): { id: string; filename: string } => {
    const id = generateUUID();
    const filename = generateImageFilename(role, id);

    if (isElectron()) {
      // Save to appropriate folder: outputs, controls, or references
      // @ts-ignore
      const result = window.electron.saveImageSync(role + 's', filename, base64Data);
      if (!result.success) {
        throw new Error(`Failed to save image: ${result.error}`);
      }
    } else {
      // For web, store base64 in localStorage
      localStorage.setItem(`image_${id}`, base64Data);
    }

    return { id, filename };
  },

  // Load image from file system or localStorage
  loadImage: (role: ImageRole, id: string, filename: string): string | null => {
    if (isElectron()) {
      // @ts-ignore
      return window.electron.loadImageSync(role + 's', filename);
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
    controlImageData?: string,
    referenceImageData?: string
  ): SessionGeneration => {
    const generation: SessionGeneration = {
      generation_id: generateUUID(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      prompt,
      parameters: config
    };

    // Save control image if provided
    if (controlImageData) {
      const imageInfo = StorageService.saveImage(controlImageData, 'control');
      generation.control_image = imageInfo;
    }

    // Save reference image if provided
    if (referenceImageData) {
      const imageInfo = StorageService.saveImage(referenceImageData, 'reference');
      generation.reference_image = imageInfo;
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
    outputImageData: string,
    timeMs: number
  ) => {
    const session = StorageService.loadSession(sessionId);
    if (!session) return;

    const generation = session.generations.find(g => g.generation_id === generationId);
    if (!generation) return;

    // Save output image
    const imageInfo = StorageService.saveImage(outputImageData, 'output');
    generation.output_image = imageInfo;
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
