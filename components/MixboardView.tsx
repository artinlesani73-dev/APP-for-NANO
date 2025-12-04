import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Type, Trash2, ZoomIn, ZoomOut, Move, Download, Edit2, Check, X, LayoutTemplate, Bold, Italic, Save, Upload, Settings, Folder, Undo, Redo, ChevronDown, Copy, FileText, Square } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/newStorageService';
import { GenerationConfig, CanvasImage, MixboardSession, MixboardGeneration, StoredImageMeta } from '../types';
import { ImageEditModal } from './ImageEditModal';
import { ProjectsPage } from './ProjectsPage';
import { SettingsModal } from './SettingsModal';

type CanvasEngine = {
  attach: (element: HTMLDivElement, options: { onZoom: (delta: number) => void }) => void;
  detach: () => void;
  registerPlugin: (name: string, plugin: unknown) => void;
  plugins: Record<string, unknown>;
  pluginsLoaded: boolean;
};

const createCanvasEngine = (): CanvasEngine => {
  let attachedElement: HTMLDivElement | null = null;
  let cleanupCallbacks: Array<() => void> = [];
  const plugins: Record<string, unknown> = {};

  const detach = () => {
    cleanupCallbacks.forEach(fn => fn());
    cleanupCallbacks = [];
    attachedElement = null;
  };

  const attach = (element: HTMLDivElement, options: { onZoom: (delta: number) => void }) => {
    if (attachedElement === element && cleanupCallbacks.length) return;

    detach();
    attachedElement = element;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      options.onZoom(delta);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    cleanupCallbacks.push(() => element.removeEventListener('wheel', handleWheel));
  };

  const registerPlugin = (name: string, plugin: unknown) => {
    plugins[name] = plugin;
  };

  return {
    attach,
    detach,
    registerPlugin,
    plugins,
    pluginsLoaded: false
  };
};

let persistentCanvasEngine: CanvasEngine | null = null;

interface MixboardViewProps {
  theme: 'dark' | 'light';
  currentSession: MixboardSession | null;
  allSessions: MixboardSession[];
  onSessionUpdate: (session: MixboardSession) => void;
  onSelectSession: (sessionId: string) => void;
  onCreateSession?: () => MixboardSession;
  currentUser?: { id: string; displayName: string } | null;
}

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

export const MixboardView: React.FC<MixboardViewProps> = ({
  theme,
  currentSession,
  allSessions,
  onSessionUpdate,
  onSelectSession,
  onCreateSession,
  currentUser
}) => {
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [isGenerating, setIsGenerating] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizingImage, setResizingImage] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showImageInput, setShowImageInput] = useState(true);  // Default to Image mode
  const [currentGeneration, setCurrentGeneration] = useState<MixboardGeneration | null>(null);
  const [textToolbar, setTextToolbar] = useState<{ targetId: string | null; x: number; y: number }>({ targetId: null, x: 0, y: 0 });
  const [draftFontSize, setDraftFontSize] = useState(16);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0
  });

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<CanvasImage | null>(null);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  // New UI state
  const [showProjectsPage, setShowProjectsPage] = useState(false);
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [editingSessionTitle, setEditingSessionTitle] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Save system state
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState(5); // minutes

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textToolbarRef = useRef<HTMLDivElement>(null);
  const canvasEngineRef = useRef<CanvasEngine | null>(persistentCanvasEngine);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const canvasImagesRef = useRef<CanvasImage[]>(canvasImages);
  const isDirtyRef = useRef(false);
  const dirtyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      canvasX: 0,
      canvasY: 0
    });
  }, []);

  // Start timer to mark as dirty 30 seconds after save
  const startDirtyTimer = useCallback(() => {
    // Clear any existing timer
    if (dirtyTimerRef.current) {
      clearTimeout(dirtyTimerRef.current);
    }

    // Set dirty flag after 30 seconds
    dirtyTimerRef.current = setTimeout(() => {
      isDirtyRef.current = true;
      setIsDirty(true);
      console.log('[DirtyTimer] Marked as dirty after 30 seconds');
    }, 30000);
  }, []);

  // Helper function to save current canvas state to session (async, non-blocking)
  const saveCanvasToSession = useCallback(async (images: CanvasImage[]) => {
    if (!currentSession) return;

    try {
      // Strip thumbnailUri from images before saving to reduce JSON size
      // Thumbnails are loaded from disk on session open
      const imagesToSave = images.map(img => {
        if (img.thumbnailPath) {
          // If thumbnail is saved to disk, don't include URI in session
          const { thumbnailUri, ...imageWithoutUri } = img;
          return imageWithoutUri;
        }
        return img;
      });

      const updatedSession: MixboardSession = {
        ...currentSession,
        canvas_images: imagesToSave,
        updated_at: new Date().toISOString()
      };

      await StorageService.saveSessionAsync(updatedSession as any);
      onSessionUpdate(updatedSession);
      isDirtyRef.current = false;
      setIsDirty(false);
      console.log('[MixboardView] Canvas saved to session:', images.length, 'images');

      // Start timer to mark as dirty after 30 seconds
      startDirtyTimer();
    } catch (error) {
      console.error('[MixboardView] Failed to save session:', error);
    }
  }, [currentSession, onSessionUpdate, startDirtyTimer]);

  // Keep ref in sync with state
  useEffect(() => {
    canvasImagesRef.current = canvasImages;
  }, [canvasImages]);

  // Manual save function (called by user or auto-save)
  const handleManualSave = useCallback(async () => {
    if (!currentSession) return;
    // Allow save anytime - just overwrites
    await saveCanvasToSession(canvasImagesRef.current);
  }, [currentSession, saveCanvasToSession]);

  // Undo/Redo functionality - simplified to avoid infinite loops
  const handleUndo = useCallback(() => {
    // TODO: Implement proper undo functionality
    console.log('Undo not yet implemented');
  }, []);

  const handleRedo = useCallback(() => {
    // TODO: Implement proper redo functionality
    console.log('Redo not yet implemented');
  }, []);

  // Helper function to get center of visible canvas area
  const getVisibleCanvasCenter = useCallback(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return { x: 100, y: 100 }; // Fallback to fixed position

    const rect = canvasElement.getBoundingClientRect();
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;

    // Convert viewport coordinates to canvas coordinates
    const canvasCenterX = (viewportCenterX - panOffset.x) / zoom;
    const canvasCenterY = (viewportCenterY - panOffset.y) / zoom;

    return { x: canvasCenterX, y: canvasCenterY };
  }, [panOffset.x, panOffset.y, zoom]);

  // Load canvas from session when session changes
  useEffect(() => {
    const loadCanvasImages = async () => {
      if (currentSession && currentSession.canvas_images) {
        console.log('[MixboardView] Loading canvas images from session:', currentSession.canvas_images.length);

        // Load thumbnails from disk if they exist
        const { loadThumbnail } = await import('../utils/imageUtils');
        const loadedImages = currentSession.canvas_images.map(img => {
          if (img.thumbnailPath && !img.thumbnailUri) {
            // Load thumbnail from disk
            const thumbnailUri = loadThumbnail(img.thumbnailPath);
            return thumbnailUri ? { ...img, thumbnailUri } : img;
          }
          return img;
        });

        setCanvasImages(loadedImages);
      } else if (currentSession) {
        console.log('[MixboardView] Session has no canvas images, starting with empty canvas');
        setCanvasImages([]);
      }
    };

    loadCanvasImages();
  }, [currentSession?.session_id]);

  // Migration: Generate thumbnails for existing images without thumbnails
  useEffect(() => {
    const migrateImages = async () => {
      // Only migrate if there are images and some don't have thumbnails
      const needsMigration = canvasImages.some(
        img => img.type !== 'text' && img.type !== 'board' && img.dataUri && !img.thumbnailUri
      );

      if (!needsMigration || canvasImages.length === 0) return;

      console.log('[MixboardView] Migrating images without thumbnails...');
      setIsGeneratingThumbnails(true);

      try {
        const { generateThumbnail, saveThumbnail } = await import('../utils/imageUtils');

        const migratedImages = await Promise.all(
          canvasImages.map(async (img) => {
            // Only generate thumbnail for images that don't have one
            if (img.type !== 'text' && img.type !== 'board' && img.dataUri && !img.thumbnailUri) {
              try {
                const thumbnailUri = await generateThumbnail(img.dataUri, 256, 0.85);

                // Save thumbnail to disk (Electron) or keep in memory (web)
                const { thumbnailUri: savedThumbnailUri, thumbnailPath } = currentSession
                  ? saveThumbnail(currentSession.session_id, img.id, thumbnailUri)
                  : { thumbnailUri };

                console.log(`[Migration] Generated and saved thumbnail for existing image:`, img.id);
                return { ...img, thumbnailUri: savedThumbnailUri, thumbnailPath };
              } catch (err) {
                console.error('Failed to generate thumbnail for image:', img.id, err);
                return img; // Keep original if thumbnail generation fails
              }
            }
            return img;
          })
        );

        // Only update if we actually migrated something
        const hasChanges = migratedImages.some((img, idx) => img.thumbnailUri !== canvasImages[idx].thumbnailUri);
        if (hasChanges) {
          setCanvasImages(migratedImages);
          saveCanvasToSession(migratedImages);
          console.log(`[MixboardView] Migration complete, ${migratedImages.filter(i => i.thumbnailUri).length} thumbnails generated`);
        }
      } catch (error) {
        console.error('Failed to migrate images:', error);
      } finally {
        setIsGeneratingThumbnails(false);
      }
    };

    // Run migration after a short delay to not block initial render
    const migrationTimeout = setTimeout(() => {
      migrateImages();
    }, 500);

    return () => clearTimeout(migrationTimeout);
  }, [currentSession?.session_id]); // Run when session changes

  // Auto-save interval timer
  useEffect(() => {
    if (!currentSession || autoSaveInterval === 0) return; // 0 = disabled

    const intervalMs = autoSaveInterval * 60 * 1000; // Convert minutes to ms
    const autoSaveTimer = setInterval(() => {
      if (isDirtyRef.current) {
        console.log('[AutoSave] Running auto-save...');
        handleManualSave();
      }
    }, intervalMs);

    return () => clearInterval(autoSaveTimer);
  }, [currentSession, autoSaveInterval, handleManualSave]); // Removed isDirty - use ref instead

  // Save on exit (component unmount or session switch)
  useEffect(() => {
    return () => {
      // Save when component unmounts or session changes
      if (isDirtyRef.current && currentSession) {
        console.log('[SaveOnExit] Saving before unmount...');
        // Use sync save for unmount to ensure it completes
        const imagesToSave = canvasImagesRef.current.map(img => {
          if (img.thumbnailPath) {
            const { thumbnailUri, ...imageWithoutUri } = img;
            return imageWithoutUri;
          }
          return img;
        });
        const updatedSession: MixboardSession = {
          ...currentSession,
          canvas_images: imagesToSave,
          updated_at: new Date().toISOString()
        };
        StorageService.saveSession(updatedSession as any);
      }
    };
  }, [currentSession]); // Only depend on currentSession, not canvasImages or isDirty

  // Save on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Show browser confirmation dialog
        e.preventDefault();
        e.returnValue = '';
        // Try to save before unload
        handleManualSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, handleManualSave]);

  // Cleanup dirty timer on unmount
  useEffect(() => {
    return () => {
      if (dirtyTimerRef.current) {
        clearTimeout(dirtyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
        setTextToolbar({ targetId: null, x: 0, y: 0 });
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);

      // Cleanup any pending animation frames on unmount
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [closeContextMenu]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (textToolbar.targetId && textToolbarRef.current && !textToolbarRef.current.contains(event.target as Node)) {
        setTextToolbar({ targetId: null, x: 0, y: 0 });
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [textToolbar.targetId]);

  useEffect(() => {
    const engine = canvasEngineRef.current ?? createCanvasEngine();
    canvasEngineRef.current = engine;
    persistentCanvasEngine = engine;

    // If there's no active session or canvas, ensure listeners are detached
    const canvasElement = canvasRef.current;
    if (!currentSession || !canvasElement) {
      engine.detach();
      return;
    }

    const schedule = 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback
      : (cb: IdleRequestCallback) => window.setTimeout(() => cb({} as IdleDeadline), 0);

    const scheduleId = schedule(() => {
      engine.attach(canvasElement, {
        onZoom: (delta) => setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)))
      });
    });

    let cancelled = false;

    const loadPlugins = async () => {
      if (engine.pluginsLoaded) return;

      try {
        const { loadOptionalCanvasPlugins } = await import('../services/canvasPlugins');
        if (!cancelled) {
          await loadOptionalCanvasPlugins(engine);
          engine.pluginsLoaded = true;
        }
      } catch (error) {
        console.warn('[MixboardView] Optional canvas plugins failed to load', error);
      }
    };

    loadPlugins();

    return () => {
      cancelled = true;
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(scheduleId as number);
      } else {
        clearTimeout(scheduleId as number);
      }
      engine.detach();
    };
  }, [currentSession?.session_id]);

  // Handle generation (image or text) with full history tracking
  const handleGenerate = async () => {
    if (!prompt && canvasImages.filter(img => img.selected).length === 0) return;
    if (!currentSession) {
      alert('No active session. Please create or select a session first.');
      return;
    }

    const existingGenerations = currentSession.generations || [];

    setIsGenerating(true);

    const generationId = `gen-${Date.now()}`;
    const selectedImages = canvasImages.filter(img => img.selected && (!img.type || img.type === 'image'));
    const prepareSelectedImages = () => {
      const inputImageMetas: StoredImageMeta[] = [];
      const referenceImageData: string[] = [];

      for (const selectedImg of selectedImages) {
        if (!selectedImg.dataUri) continue;

        referenceImageData.push(selectedImg.dataUri);

        if (selectedImg.imageMetaId) {
          inputImageMetas.push({
            id: selectedImg.imageMetaId,
            filename: `input_${selectedImg.imageMetaId}.png`,
            size_bytes: selectedImg.dataUri.length
          });
        } else {
          const meta = StorageService.saveImage(selectedImg.dataUri, 'reference');
          inputImageMetas.push(meta);
        }
      }

      return { inputImageMetas, referenceImageData };
    };

    const { inputImageMetas, referenceImageData } = prepareSelectedImages();
    const startTime = Date.now();

    try {
      // Create generation record BEFORE API call (only persisted for image generations)
      const newGeneration: MixboardGeneration = {
        generation_id: generationId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        prompt: prompt || (showImageInput ? 'Continue the creative exploration' : 'Generate text'),
        input_images: inputImageMetas,  // Save selected images even for text requests
        output_images: [],
        parameters: config,
        canvas_state: {
          images: canvasImages,
          zoom,
          panOffset
        },
        parent_generation_ids: selectedImages
          .map(img => img.generationId)
          .filter(Boolean) as string[]
      };

      setCurrentGeneration(newGeneration);

      if (showImageInput) {
        // IMAGE MODE: Generate image
        // Call API for image generation
        const output = await GeminiService.generateImage(
          newGeneration.prompt,
          config,
          undefined,  // No control images in Mixboard
          referenceImageData,
          currentUser?.displayName
        );

      if (output.images && output.images.length > 0) {
        const imageDataUri = `data:image/png;base64,${output.images[0]}`;

        // Save output image to storage
        const outputImageMeta = StorageService.saveImage(imageDataUri, 'output');

        // Calculate duration
        const duration = Date.now() - startTime;

        // Complete generation record
        const completedGeneration: MixboardGeneration = {
          ...newGeneration,
          status: 'completed',
          input_images: inputImageMetas,
          output_images: [outputImageMeta],
          output_texts: output.texts,
          generation_time_ms: duration
        };

        // Add generated image to canvas
        const img = new Image();
        img.onload = async () => {
          // Generate thumbnail for the output image
          setIsGeneratingThumbnails(true);
          try {
            const { generateThumbnail, saveThumbnail } = await import('../utils/imageUtils');
            const thumbnailUri = await generateThumbnail(imageDataUri, 256, 0.85);
            const imageId = `img-${Date.now()}`;

            // Save thumbnail to disk (Electron) or keep in memory (web)
            const { thumbnailUri: savedThumbnailUri, thumbnailPath } = currentSession
              ? saveThumbnail(currentSession.session_id, imageId, thumbnailUri)
              : { thumbnailUri };

            // Place image at center of visible canvas
            const center = getVisibleCanvasCenter();
            const imageWidth = 300;
            const imageHeight = (imageWidth * img.height) / img.width;

            const newCanvasImage: CanvasImage = {
              id: imageId,
              dataUri: imageDataUri,
              thumbnailUri: savedThumbnailUri,
              thumbnailPath,
              x: center.x - imageWidth / 2,
              y: center.y - imageHeight / 2,
              width: imageWidth,
              height: imageHeight,
              selected: false,
              originalWidth: img.width,
              originalHeight: img.height,
              generationId: generationId,
              imageMetaId: outputImageMeta.id
            };

            setCanvasImages(prev => {
              const updatedCanvasImages = [...prev, newCanvasImage];

              // Update session with new generation and canvas state
              const updatedSession: MixboardSession = {
                ...currentSession,
                generations: [...existingGenerations, completedGeneration],
                canvas_images: updatedCanvasImages,
                updated_at: new Date().toISOString()
              };

              // Persist session
              StorageService.saveSession(updatedSession as any);
              onSessionUpdate(updatedSession);

              return updatedCanvasImages;
            });

            setCurrentGeneration(completedGeneration);
            console.log(`[Generation] Output image added:`, imageId, `Thumbnail path: ${thumbnailPath || 'in-memory'}`);
          } catch (error) {
            console.error('Failed to generate thumbnail for output image:', error);
            // Still add image without thumbnail as fallback
            // Place image at center of visible canvas
            const center = getVisibleCanvasCenter();
            const imageWidth = 300;
            const imageHeight = (imageWidth * img.height) / img.width;

            const newCanvasImage: CanvasImage = {
              id: `img-${Date.now()}`,
              dataUri: imageDataUri,
              x: center.x - imageWidth / 2,
              y: center.y - imageHeight / 2,
              width: imageWidth,
              height: imageHeight,
              selected: false,
              originalWidth: img.width,
              originalHeight: img.height,
              generationId: generationId,
              imageMetaId: outputImageMeta.id
            };

            setCanvasImages(prev => {
              const updatedCanvasImages = [...prev, newCanvasImage];

              const updatedSession: MixboardSession = {
                ...currentSession,
                generations: [...existingGenerations, completedGeneration],
                canvas_images: updatedCanvasImages,
                updated_at: new Date().toISOString()
              };

              StorageService.saveSession(updatedSession as any);
              onSessionUpdate(updatedSession);

              return updatedCanvasImages;
            });

            setCurrentGeneration(completedGeneration);
          } finally {
            setIsGeneratingThumbnails(false);
          }
        };
        img.src = imageDataUri;
      }
      } else {
        // TEXT MODE: Generate text
        const output = await GeminiService.generateText(
          newGeneration.prompt,
          config,
          150,  // Max 150 words
          currentUser?.displayName,
          referenceImageData
        );

        if (output.text) {
          // Calculate duration
          const duration = Date.now() - startTime;

          // Add generated text to canvas
          const textWidth = 400;
          const textHeight = 200;
          const fontSize = 16;

          // Place text at center of visible canvas
          const center = getVisibleCanvasCenter();

          const newCanvasText: CanvasImage = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: output.text,
            fontSize: fontSize,
            fontWeight: 'normal',
            fontStyle: 'normal',
            fontFamily: 'Inter, system-ui, sans-serif',
            x: center.x - textWidth / 2,
            y: center.y - textHeight / 2,
            width: textWidth,
            height: textHeight,
            selected: false,
            originalWidth: textWidth,
            originalHeight: textHeight,
            generationId: generationId
          };

          const updatedCanvasImages = [...canvasImages, newCanvasText];
          setCanvasImages(updatedCanvasImages);

          // Update session with canvas state only (text generations are not stored in history)
          const updatedSession: MixboardSession = {
            ...currentSession,
            generations: existingGenerations,
            canvas_images: updatedCanvasImages,
            updated_at: new Date().toISOString()
          };

          // Persist session
          StorageService.saveSession(updatedSession as any);
          onSessionUpdate(updatedSession);
          setCurrentGeneration(null);
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);

      // Mark generation as failed
      const failedGeneration: MixboardGeneration = {
        generation_id: generationId,
        timestamp: new Date().toISOString(),
        status: 'failed',
        prompt: prompt || 'Continue the creative exploration',
        input_images: inputImageMetas,
        output_images: [],
        parameters: config,
        error_message: (error as Error).message,
        generation_time_ms: Date.now() - startTime,
        canvas_state: {
          images: canvasImages,
          zoom,
          panOffset
        }
      };

      // Only persist failed generations for image requests; text failures still update canvas state timestamp
      const updatedSession: MixboardSession = showImageInput
        ? {
            ...currentSession,
            generations: [...existingGenerations, failedGeneration],
            updated_at: new Date().toISOString()
          }
        : {
            ...currentSession,
            generations: existingGenerations,
            updated_at: new Date().toISOString()
          };

      StorageService.saveSession(updatedSession as any);
      onSessionUpdate(updatedSession);

      setCurrentGeneration(showImageInput ? failedGeneration : null);
      alert('Generation failed: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const addTextToCanvas = (text: string, x?: number, y?: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const textWidth = 400;
    const textHeight = 200;
    const fontSize = 16;

    setCanvasImages(prev => {
      const baseX = typeof x === 'number' ? x : 100 + (prev.length * 50);
      const baseY = typeof y === 'number' ? y : 100 + (prev.length * 50);

      const newCanvasText: CanvasImage = {
        id: `text-${Date.now()}`,
        type: 'text',
        text: trimmed,
        fontSize: fontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontFamily: 'Inter, system-ui, sans-serif',
        x: baseX,
        y: baseY,
        width: textWidth,
        height: textHeight,
        selected: false,
        originalWidth: textWidth,
        originalHeight: textHeight
      };

      return [...prev, newCanvasText];
    });
    
  };

  const updateTextEntity = (id: string, updates: Partial<CanvasImage>) => {
    setCanvasImages(prev => {
      return prev.map(img => img.id === id ? { ...img, ...updates } : img);
    });
    
  };

  // Inline toolbar handlers for selected items
  const handleEditImage = (imageId: string) => {
    const image = canvasImages.find(img => img.id === imageId);
    if (image && image.dataUri) {
      setEditingImage(image);
      setEditModalOpen(true);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    setCanvasImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleDuplicateImage = (imageId: string) => {
    const image = canvasImages.find(img => img.id === imageId);
    if (!image) return;

    const newImage: CanvasImage = {
      ...image,
      id: `${image.type || 'img'}-${Date.now()}`,
      x: image.x + 20,
      y: image.y + 20,
      selected: false
    };
    setCanvasImages(prev => [...prev, newImage]);
  };

  const handleSaveEditedImage = async (editedDataUri: string) => {
    if (!editingImage) return;

    // Import thumbnail generator and saver
    const { generateThumbnail, saveThumbnail } = await import('../utils/imageUtils');

    // Generate new thumbnail from edited image
    setIsGeneratingThumbnails(true);
    try {
      const newThumbnail = await generateThumbnail(editedDataUri, 256, 0.85);

      // Save thumbnail to disk (Electron) or keep in memory (web)
      const { thumbnailUri: savedThumbnailUri, thumbnailPath } = currentSession
        ? saveThumbnail(currentSession.session_id, editingImage.id, newThumbnail)
        : { thumbnailUri: newThumbnail };

      // Update canvas image with new original and thumbnail
      setCanvasImages(prev =>
        prev.map(img =>
          img.id === editingImage.id
            ? { ...img, dataUri: editedDataUri, thumbnailUri: savedThumbnailUri, thumbnailPath }
            : img
        )
      );
      

      console.log(`[Edit] Image updated:`, editingImage.id, `Thumbnail path: ${thumbnailPath || 'in-memory'}`);
    } catch (error) {
      console.error('Failed to generate thumbnail for edited image:', error);
      // Still update the image even if thumbnail generation fails
      setCanvasImages(prev =>
        prev.map(img =>
          img.id === editingImage.id
            ? { ...img, dataUri: editedDataUri }
            : img
        )
      );
      
    } finally {
      setIsGeneratingThumbnails(false);
      setEditingImage(null);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsGeneratingThumbnails(true);

    try {
      const { generateThumbnail, saveThumbnail } = await import('../utils/imageUtils');

      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUri = event.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            try {
              // Generate thumbnail for canvas display (256px for better performance)
              const thumbnailUri = await generateThumbnail(dataUri, 256, 0.85);
              const imageId = `img-${Date.now()}-${Math.random()}`;

              // Save thumbnail to disk (Electron) or keep in memory (web)
              const { thumbnailUri: savedThumbnailUri, thumbnailPath } = currentSession
                ? saveThumbnail(currentSession.session_id, imageId, thumbnailUri)
                : { thumbnailUri };

              const newImage: CanvasImage = {
                id: imageId,
                dataUri,
                thumbnailUri: savedThumbnailUri,
                thumbnailPath,
                x: 100,
                y: 100,
                width: 300,
                height: (300 * img.height) / img.width,
                selected: false,
                originalWidth: img.width,
                originalHeight: img.height
              };

              // Use functional update to avoid stale state
              setCanvasImages(prev => [...prev, newImage]);
              

              console.log(`[Upload] Image added:`, newImage.id, `Thumbnail path: ${thumbnailPath || 'in-memory'}`);
            } catch (error) {
              console.error('Failed to generate thumbnail:', error);
              // Still add the image without thumbnail as fallback
              const newImage: CanvasImage = {
                id: `img-${Date.now()}-${Math.random()}`,
                dataUri,
                x: 100,
                y: 100,
                width: 300,
                height: (300 * img.height) / img.width,
                selected: false,
                originalWidth: img.width,
                originalHeight: img.height
              };

              setCanvasImages(prev => [...prev, newImage]);
              
            }
          };
          img.src = dataUri;
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setTimeout(() => setIsGeneratingThumbnails(false), 1000);
      e.target.value = '';
    }
  };

  // Handle drag and drop from outside
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setIsGeneratingThumbnails(true);

    try {
      const { generateThumbnail, saveThumbnail } = await import('../utils/imageUtils');

      for (const [index, file] of Array.from(files).entries()) {
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUri = event.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            const dropX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
            const dropY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

            try {
              // Generate thumbnail for canvas display (256px for better performance)
              const thumbnailUri = await generateThumbnail(dataUri, 256, 0.85);
              const imageId = `img-${Date.now()}-${index}`;

              // Save thumbnail to disk (Electron) or keep in memory (web)
              const { thumbnailUri: savedThumbnailUri, thumbnailPath } = currentSession
                ? saveThumbnail(currentSession.session_id, imageId, thumbnailUri)
                : { thumbnailUri };

              const newImage: CanvasImage = {
                id: imageId,
                dataUri,
                thumbnailUri: savedThumbnailUri,
                thumbnailPath,
                x: dropX,
                y: dropY,
                width: 300,
                height: (300 * img.height) / img.width,
                selected: false,
                originalWidth: img.width,
                originalHeight: img.height
              };

              setCanvasImages(prev => [...prev, newImage]);
              

              console.log(`[Drop] Image added:`, newImage.id, `Thumbnail path: ${thumbnailPath || 'in-memory'}`);
            } catch (error) {
              console.error('Failed to generate thumbnail:', error);
              // Still add the image without thumbnail as fallback
              const newImage: CanvasImage = {
                id: `img-${Date.now()}-${index}`,
                dataUri,
                x: dropX,
                y: dropY,
                width: 300,
                height: (300 * img.height) / img.width,
                selected: false,
                originalWidth: img.width,
                originalHeight: img.height
              };

              setCanvasImages(prev => [...prev, newImage]);
              
            }
          };
          img.src = dataUri;
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setTimeout(() => setIsGeneratingThumbnails(false), 1000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOpenUploadFromContext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeContextMenu();
    fileInputRef.current?.click();
  };

  const handleAddTextFromContext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { canvasX, canvasY } = contextMenu;
    closeContextMenu();

    const manualText = window.prompt('Enter text to add to the canvas:');
    if (manualText && manualText.trim()) {
      addTextToCanvas(manualText, canvasX, canvasY);
    }
  };

  const handleAddWhiteboardFromContext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { canvasX, canvasY } = contextMenu;
    closeContextMenu();

    const boardWidth = 640;
    const boardHeight = 420;

    setCanvasImages(prev => {
      const newBoard: CanvasImage = {
        id: `board-${Date.now()}`,
        type: 'board',
        backgroundColor: '#ffffff',
        x: canvasX,
        y: canvasY,
        width: boardWidth,
        height: boardHeight,
        selected: false,
        originalWidth: boardWidth,
        originalHeight: boardHeight
      };

      return [...prev, newBoard];
    });
    
  };

  const handleTextDoubleClick = (e: React.MouseEvent, image: CanvasImage) => {
    e.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setDraftFontSize(image.fontSize || 16);
    setTextToolbar({
      targetId: image.id,
      x: e.clientX - canvasRect.left + 10,
      y: e.clientY - canvasRect.top - 10
    });
  };

  // Handle image selection and dragging
  const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();

    const image = canvasImages.find(img => img.id === imageId);
    if (!image) return;

    // Check if clicking on resize handle (bottom-right corner)
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const imageScreenX = image.x * zoom + panOffset.x;
    const imageScreenY = image.y * zoom + panOffset.y;
    const imageScreenWidth = image.width * zoom;
    const imageScreenHeight = image.height * zoom;

    const clickX = e.clientX - canvasRect.left;
    const clickY = e.clientY - canvasRect.top;

    const isResizeHandle =
      clickX >= imageScreenX + imageScreenWidth - 20 &&
      clickX <= imageScreenX + imageScreenWidth &&
      clickY >= imageScreenY + imageScreenHeight - 20 &&
      clickY <= imageScreenY + imageScreenHeight;

    if (isResizeHandle) {
      setResizingImage(imageId);
      setDragStart({ x: clickX, y: clickY });
    } else {
      // Toggle selection with Ctrl/Cmd, otherwise select only this image
      if (e.ctrlKey || e.metaKey) {
        setCanvasImages(prev => prev.map(img =>
          img.id === imageId ? { ...img, selected: !img.selected } : img
        ));
      } else {
        setCanvasImages(prev => prev.map(img => ({
          ...img,
          selected: img.id === imageId
        })));
      }

      setDraggedImage(imageId);
      setDragStart({ x: clickX, y: clickY });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    closeContextMenu();
    setTextToolbar({ targetId: null, x: 0, y: 0 });
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      // Start panning with middle mouse or space+left click
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (e.button === 0) {
        // Start box selection
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;

        const startX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
        const startY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

        setIsSelecting(true);
        setSelectionBox({ startX, startY, endX: startX, endY: startY });

        // Clear selection if not holding Ctrl/Cmd
        if (!e.ctrlKey && !e.metaKey) {
          setCanvasImages(prev => prev.map(img => ({ ...img, selected: false })));
        }
      }
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const canvasX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
    const canvasY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      canvasX,
      canvasY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Throttle updates using requestAnimationFrame
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Skip if we updated less than 16ms ago (60fps)
    if (timeSinceLastUpdate < 16) return;

    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      lastUpdateRef.current = now;
    } else if (resizingImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use RAF to batch updates
      rafRef.current = requestAnimationFrame(() => {
        setCanvasImages(prev => prev.map(img => {
          if (img.id === resizingImage) {
            const minSize = 50;

            if (img.type === 'text') {
              return {
                ...img,
                width: Math.max(minSize, img.width + dx),
                height: Math.max(minSize, img.height + dy)
              };
            }

            const aspectRatio = img.originalHeight / img.originalWidth;
            const newWidth = Math.max(minSize, img.width + dx);
            return {
              ...img,
              width: newWidth,
              height: newWidth * aspectRatio
            };
          }
          return img;
        }));

        setDragStart({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
        lastUpdateRef.current = now;
      });
    } else if (draggedImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use RAF to batch updates
      rafRef.current = requestAnimationFrame(() => {
        setCanvasImages(prev => prev.map(img => {
          if (img.selected || img.id === draggedImage) {
            return {
              ...img,
              x: img.x + dx,
              y: img.y + dy
            };
          }
          return img;
        }));

        setDragStart({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
        lastUpdateRef.current = now;
      });
    } else if (isSelecting && selectionBox) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      // Throttle to 60fps
      const now = Date.now();
      if (now - lastUpdateRef.current < 16) return;

      const endX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
      const endY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

      setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Use RAF to batch updates
      rafRef.current = requestAnimationFrame(() => {
        // Update selection
        const minX = Math.min(selectionBox.startX, endX);
        const maxX = Math.max(selectionBox.startX, endX);
        const minY = Math.min(selectionBox.startY, endY);
        const maxY = Math.max(selectionBox.startY, endY);

        setCanvasImages(prev => prev.map(img => {
          const imgCenterX = img.x + img.width / 2;
          const imgCenterY = img.y + img.height / 2;
          const intersects =
            imgCenterX >= minX && imgCenterX <= maxX &&
            imgCenterY >= minY && imgCenterY <= maxY;

          return { ...img, selected: intersects || (e.ctrlKey || e.metaKey ? img.selected : false) };
        }));

        lastUpdateRef.current = now;
      });
    }
  };

  const handleMouseUp = () => {
    // Cancel any pending animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setDraggedImage(null);
    setResizingImage(null);
    setIsSelecting(false);
    setSelectionBox(null);
    setIsPanning(false);
    setDragStart(null);
  };

  // Delete selected images
  const handleDeleteSelected = useCallback(() => {
    setCanvasImages(prev => prev.filter(img => !img.selected));
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' ||
                       activeElement?.tagName === 'TEXTAREA' ||
                       activeElement?.hasAttribute('contenteditable');

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey) && !isTyping) {
        e.preventDefault();
        setCanvasImages(prev => prev.map(img => ({ ...img, selected: true })));
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleManualSave();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey) && !isTyping) ||
                 (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey && !isTyping)) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, handleManualSave, handleUndo, handleRedo]);

  const selectedCount = canvasImages.filter(img => img.selected).length;

  return (
    <>
      {showProjectsPage && (
        <ProjectsPage
          theme={theme}
          sessions={allSessions}
          onSelectSession={onSelectSession}
          onClose={() => setShowProjectsPage(false)}
          onDeleteSession={(sessionId) => {
            StorageService.deleteSession(sessionId);
            window.location.reload();
          }}
        />
      )}

      <div className="h-full w-full flex bg-white dark:bg-black relative">
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Top-Left Session Toolbar */}
        <div className="absolute top-4 left-4 z-40">
          <div className="relative">
            {editingSessionTitle ? (
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg px-3 py-2">
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-48 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && currentSession) {
                      StorageService.renameSession(currentSession.session_id, newSessionTitle);
                      const updatedSession = { ...currentSession, title: newSessionTitle };
                      onSessionUpdate(updatedSession as MixboardSession);
                      setEditingSessionTitle(false);
                    } else if (e.key === 'Escape') {
                      setEditingSessionTitle(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (currentSession) {
                      StorageService.renameSession(currentSession.session_id, newSessionTitle);
                      const updatedSession = { ...currentSession, title: newSessionTitle };
                      onSessionUpdate(updatedSession as MixboardSession);
                      setEditingSessionTitle(false);
                    }
                  }}
                  className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingSessionTitle(false)}
                  className="p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
                  onDoubleClick={() => {
                    if (currentSession) {
                      setNewSessionTitle(currentSession.title);
                      setEditingSessionTitle(true);
                    }
                  }}
                  className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FileText size={16} className="text-zinc-600 dark:text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {currentSession?.title || 'No Session'}
                  </span>
                  <ChevronDown size={16} className="text-zinc-600 dark:text-zinc-400" />
                </button>

                {sessionDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSessionDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setShowProjectsPage(true);
                          setSessionDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700"
                      >
                        <Folder size={16} />
                        Projects
                      </button>
                      <button
                        onClick={() => {
                          onCreateSession && onCreateSession();
                          setSessionDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700"
                      >
                        <Sparkles size={16} />
                        New Session
                      </button>
                      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                        Recent Sessions
                      </div>
                      {allSessions.slice(0, 3).map(session => (
                        <button
                          key={session.session_id}
                          onClick={() => {
                            onSelectSession(session.session_id);
                            setSessionDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                            currentSession?.session_id === session.session_id
                              ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                              : 'text-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          <div className="truncate">{session.title}</div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          if (currentSession) {
                            const dataStr = JSON.stringify(currentSession, null, 2);
                            const blob = new Blob([dataStr], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `mixboard-session-${currentSession.session_id}.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }
                          setSessionDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-700"
                      >
                        <Download size={16} />
                        Export JSON
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Left-Side Vertical Toolbar - Unified */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
          <button
            className="p-3 w-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
            title="Templates (Coming Soon)"
          >
            <LayoutTemplate size={20} className="text-zinc-600 dark:text-zinc-400 mx-auto" />
          </button>
          <button
            className="p-3 w-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
            title="Assets (Coming Soon)"
          >
            <ImageIcon size={20} className="text-zinc-600 dark:text-zinc-400 mx-auto" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 w-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
            title="Upload Image"
          >
            <Upload size={20} className="text-zinc-600 dark:text-zinc-400 mx-auto" />
          </button>
          <button
            onClick={handleAddWhiteboardFromContext}
            className="p-3 w-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
            title="Add Whiteboard"
          >
            <Square size={20} className="text-zinc-600 dark:text-zinc-400 mx-auto" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 w-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Settings"
          >
            <Settings size={20} className="text-zinc-600 dark:text-zinc-400 mx-auto" />
          </button>
        </div>

        {/* Main Content */}
        {currentSession ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair canvas-background"
          style={{
            backgroundImage: theme === 'dark'
              ? 'radial-gradient(circle, #27272a 1px, transparent 1px)'
              : 'radial-gradient(circle, #e4e4e7 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onContextMenu={handleCanvasContextMenu}
        >
          {/* Empty Canvas Message */}
          {canvasImages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-8 max-w-md">
                <Sparkles className="mx-auto mb-4 text-zinc-400 dark:text-zinc-600" size={48} />
                <h3 className="text-lg font-bold text-zinc-600 dark:text-zinc-400 mb-2">
                  Your canvas is empty
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-4">
                  Start by generating an image or drag & drop images to the canvas
                </p>
                <div className="text-xs text-zinc-400 dark:text-zinc-600 space-y-1">
                  <p>• Write a prompt and click Generate</p>
                  <p>• Drag & drop images from your computer</p>
                  <p>• Select images and generate to create variations</p>
                </div>
              </div>
            </div>
          )}

          {/* Canvas Images & Text */}
          {canvasImages.map(image => (
            <React.Fragment key={image.id}>
              <div
                className={`absolute cursor-move ${image.selected ? 'ring-4 ring-orange-500' : 'ring-1 ring-zinc-300 dark:ring-zinc-700'}`}
                style={{
                  left: `${image.x * zoom + panOffset.x}px`,
                  top: `${image.y * zoom + panOffset.y}px`,
                  width: `${image.width * zoom}px`,
                  height: `${image.height * zoom}px`,
                  transformOrigin: 'top left',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
                onMouseDown={(e) => handleImageMouseDown(e, image.id)}
                onDoubleClick={(e) => {
                  if (image.type === 'text') {
                    handleTextDoubleClick(e, image);
                  }
                }}
              >
                {image.type === 'text' ? (
                  <div
                    className="w-full h-full p-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-auto pointer-events-none"
                    style={{
                      fontSize: `${(image.fontSize || 16) * zoom}px`,
                      lineHeight: '1.5',
                      fontWeight: image.fontWeight || 'normal',
                      fontStyle: image.fontStyle || 'normal',
                      fontFamily: image.fontFamily || 'Inter, system-ui, sans-serif'
                    }}
                  >
                    {image.text}
                  </div>
                ) : image.type === 'board' ? (
                  <div
                    className="w-full h-full border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/80 pointer-events-none"
                    style={{ backgroundColor: image.backgroundColor || '#ffffff' }}
                  />
                ) : (
                  <img
                    src={image.thumbnailUri || image.dataUri}
                    alt="Canvas item"
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                    style={{
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none'
                    } as React.CSSProperties}
                    onDragStart={(e) => e.preventDefault()}
                  />
                )}
                {image.selected && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-nwse-resize" />
                )}
              </div>

              {/* Inline Toolbar for Selected Item */}
              {image.selected && selectedCount === 1 && (
                <div
                  className="absolute flex items-center gap-1 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-sm border border-zinc-700 dark:border-zinc-600 rounded-lg shadow-xl px-2 py-1.5"
                  style={{
                    left: `${image.x * zoom + panOffset.x}px`,
                    top: `${(image.y + image.height) * zoom + panOffset.y + 8}px`,
                    zIndex: 1000
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {image.type !== 'text' && image.dataUri && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditImage(image.id);
                      }}
                      className="p-1.5 rounded hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} className="text-white" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateImage(image.id);
                    }}
                    className="p-1.5 rounded hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={16} className="text-white" />
                  </button>
                  <div className="w-px h-4 bg-zinc-600 mx-1"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(image.id);
                    }}
                    className="p-1.5 rounded hover:bg-red-600 dark:hover:bg-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-white" />
                  </button>
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Selection Box */}
          {isSelecting && selectionBox && (
            <div
              className="absolute border-2 border-orange-500 bg-orange-500/10 pointer-events-none"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.endX) * zoom + panOffset.x}px`,
                top: `${Math.min(selectionBox.startY, selectionBox.endY) * zoom + panOffset.y}px`,
                width: `${Math.abs(selectionBox.endX - selectionBox.startX) * zoom}px`,
                height: `${Math.abs(selectionBox.endY - selectionBox.startY) * zoom}px`
              }}
            />
          )}

          {/* Bottom-Center Toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 dark:border-zinc-600 rounded-full shadow-xl px-4 py-2">
            <button
              onClick={handleUndo}
              disabled={true}
              className="p-2 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo (Coming Soon)"
            >
              <Undo size={18} className="text-white" />
            </button>
            <button
              onClick={handleRedo}
              disabled={true}
              className="p-2 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo (Coming Soon)"
            >
              <Redo size={18} className="text-white" />
            </button>
            <div className="w-px h-6 bg-zinc-600"></div>
            <button
              onClick={() => setZoom(prev => Math.round((prev - 0.1) * 10) / 10)}
              disabled={zoom <= 0.1}
              className="p-2 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} className="text-white" />
            </button>
            <div className="px-3 py-1 min-w-[60px] text-center text-sm font-medium text-white">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setZoom(prev => Math.round((prev + 0.1) * 10) / 10)}
              disabled={zoom >= 3}
              className="p-2 rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} className="text-white" />
            </button>
          </div>

          {textToolbar.targetId && (() => {
            const textTarget = canvasImages.find(img => img.id === textToolbar.targetId && img.type === 'text');
            if (!textTarget) return null;

            return (
              <div
                ref={textToolbarRef}
                className="absolute z-50 w-72 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg space-y-2"
                style={{ left: textToolbar.x, top: textToolbar.y }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Font size</label>
                  <input
                    type="number"
                    min={10}
                    max={72}
                    value={draftFontSize}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 10;
                      setDraftFontSize(value);
                      updateTextEntity(textTarget.id, { fontSize: value });
                    }}
                    className="w-20 px-2 py-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateTextEntity(textTarget.id, { fontWeight: textTarget.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={`p-1 rounded border ${textTarget.fontWeight === 'bold' ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                      aria-label="Toggle bold"
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      onClick={() => updateTextEntity(textTarget.id, { fontStyle: textTarget.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`p-1 rounded border ${textTarget.fontStyle === 'italic' ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                      aria-label="Toggle italic"
                    >
                      <Italic size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={textTarget.text || ''}
                  onChange={(e) => updateTextEntity(textTarget.id, { text: e.target.value })}
                  className="w-full h-24 text-sm px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded focus:outline-none focus:border-orange-500 text-zinc-800 dark:text-zinc-100"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => setTextToolbar({ targetId: null, x: 0, y: 0 })}
                    className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}

          </div>

          {/* Right Sidebar - Generation Controls */}
          <div className="w-96 border-l border-zinc-200 dark:border-zinc-800 p-6 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
            <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">Generate</h3>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowImageInput(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border transition-colors ${
                  !showImageInput
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
                }`}
              >
                <Type size={16} />
                Text
              </button>
              <button
                onClick={() => setShowImageInput(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border transition-colors ${
                  showImageInput
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
                }`}
              >
                <ImageIcon size={16} />
                Image
              </button>
            </div>

            {/* Prompt Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedCount > 0 ? "Describe how to transform selected images..." : "Describe an image to generate..."}
                className="w-full h-32 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Selected Images Info */}
            {selectedCount > 0 && (
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  {selectedCount} image{selectedCount > 1 ? 's' : ''} selected and will be used as reference
                </p>
              </div>
            )}

            {/* Model Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Model
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="gemini-2.5-flash-image">Flash (Free, Fast)</option>
                <option value="gemini-3-pro-image-preview">Pro (Paid, Higher Quality)</option>
              </select>
            </div>

            {/* Aspect Ratio */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['1:1', '16:9', '9:16', '3:4', '4:3'].map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setConfig(prev => ({ ...prev, aspect_ratio: ratio }))}
                    className={`py-2 px-3 rounded border transition-colors text-sm ${
                      config.aspect_ratio === ratio
                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                        : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 transition-all ${
                isGenerating
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg'
              }`}
            >
              {isGenerating ? (
                'Generating...'
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/80">
          <div className="max-w-lg w-full mx-auto text-center space-y-4 p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400 text-sm font-semibold">
              <Sparkles size={18} />
              <span>Mixboard is ready</span>
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Choose where to start</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create a fresh Mixboard or select a session from the menu in the top-left.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onCreateSession && onCreateSession()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg shadow hover:bg-orange-600 transition-colors"
              >
                Create new Mixboard
              </button>
              {allSessions.length > 0 && (
                <button
                  onClick={() => onSelectSession(allSessions[0].session_id)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Open most recent
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Use the session menu in the top-left corner to switch between your projects.
            </p>
          </div>
          </div>
        )}

        {/* ImageEditModal */}
        <ImageEditModal
          isOpen={editModalOpen}
          image={editingImage?.dataUri || null}
          onClose={() => {
            setEditModalOpen(false);
            setEditingImage(null);
          }}
          onSave={handleSaveEditedImage}
        />

        {/* SettingsModal */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          theme={theme}
          onThemeChange={(newTheme: 'dark' | 'light') => {
            // Theme change will be handled by parent component
            console.log('Theme change requested:', newTheme);
          }}
        />

        {/* Thumbnail Generation Loading Indicator */}
        {isGeneratingThumbnails && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Generating thumbnails...
          </div>
        )}
      </div>
    </>
  );
};