import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Type, Trash2, ZoomIn, ZoomOut, Move, Download, Edit2, Check, X } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/newStorageService';
import { GenerationConfig, CanvasImage, MixboardSession, MixboardGeneration, StoredImageMeta } from '../types';

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
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      canvasX: 0,
      canvasY: 0
    });
  }, []);

  // Initialize session if needed
  useEffect(() => {
    if (!currentSession && onCreateSession && currentUser) {
      console.log('[MixboardView] No session found, creating new session...');
      onCreateSession();
    }
  }, [currentSession, onCreateSession, currentUser]);

  // Load canvas from session when session changes
  useEffect(() => {
    if (currentSession && currentSession.canvas_images) {
      console.log('[MixboardView] Loading canvas images from session:', currentSession.canvas_images.length);
      setCanvasImages(currentSession.canvas_images);
    } else if (currentSession) {
      console.log('[MixboardView] Session has no canvas images, starting with empty canvas');
      setCanvasImages([]);
    }
  }, [currentSession?.session_id]);

  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeContextMenu]);

  // Helper function to save current canvas state to session
  const saveCanvasToSession = (images: CanvasImage[]) => {
    if (!currentSession) return;

    const updatedSession: MixboardSession = {
      ...currentSession,
      canvas_images: images,
      updated_at: new Date().toISOString()
    };

    StorageService.saveSession(updatedSession as any);
    onSessionUpdate(updatedSession);
    console.log('[MixboardView] Canvas saved to session:', images.length, 'images');
  };

  // Handle generation (image or text) with full history tracking
  const handleGenerate = async () => {
    if (!prompt && canvasImages.filter(img => img.selected).length === 0) return;
    if (!currentSession) {
      alert('No active session. Please create or select a session first.');
      return;
    }

    setIsGenerating(true);

    const generationId = `gen-${Date.now()}`;
    const selectedImages = canvasImages.filter(img => img.selected && img.type !== 'text');
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
      // Create generation record BEFORE API call
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
        img.onload = () => {
          const newCanvasImage: CanvasImage = {
            id: `img-${Date.now()}`,
            dataUri: imageDataUri,
            x: 100 + (canvasImages.length * 50),
            y: 100 + (canvasImages.length * 50),
            width: 300,
            height: (300 * img.height) / img.width,
            selected: false,
            originalWidth: img.width,
            originalHeight: img.height,
            generationId: generationId,
            imageMetaId: outputImageMeta.id
          };

          const updatedCanvasImages = [...canvasImages, newCanvasImage];
          setCanvasImages(updatedCanvasImages);

          // Update session with new generation and canvas state
          const updatedSession: MixboardSession = {
            ...currentSession,
            generations: [...currentSession.generations, completedGeneration],
            canvas_images: updatedCanvasImages,
            updated_at: new Date().toISOString()
          };

          // Persist session
          StorageService.saveSession(updatedSession as any);
          onSessionUpdate(updatedSession);

          setCurrentGeneration(completedGeneration);
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

          // Complete generation record (no output images for text)
          const completedGeneration: MixboardGeneration = {
            ...newGeneration,
            status: 'completed',
            input_images: inputImageMetas,
            output_images: [],
            output_texts: [output.text],
            generation_time_ms: duration
          };

          // Add generated text to canvas
          const textWidth = 400;
          const textHeight = 200;
          const fontSize = 16;

          const newCanvasText: CanvasImage = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: output.text,
            fontSize: fontSize,
            x: 100 + (canvasImages.length * 50),
            y: 100 + (canvasImages.length * 50),
            width: textWidth,
            height: textHeight,
            selected: false,
            originalWidth: textWidth,
            originalHeight: textHeight,
            generationId: generationId
          };

          const updatedCanvasImages = [...canvasImages, newCanvasText];
          setCanvasImages(updatedCanvasImages);

          // Update session with new generation and canvas state
          const updatedSession: MixboardSession = {
            ...currentSession,
            generations: [...currentSession.generations, completedGeneration],
            canvas_images: updatedCanvasImages,
            updated_at: new Date().toISOString()
          };

          // Persist session
          StorageService.saveSession(updatedSession as any);
          onSessionUpdate(updatedSession);

          setCurrentGeneration(completedGeneration);
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

      // Update session with failed generation
      const updatedSession: MixboardSession = {
        ...currentSession,
        generations: [...currentSession.generations, failedGeneration],
        updated_at: new Date().toISOString()
      };

      StorageService.saveSession(updatedSession as any);
      onSessionUpdate(updatedSession);

      setCurrentGeneration(failedGeneration);
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
        x: baseX,
        y: baseY,
        width: textWidth,
        height: textHeight,
        selected: false,
        originalWidth: textWidth,
        originalHeight: textHeight
      };

      const updated = [...prev, newCanvasText];
      saveCanvasToSession(updated);
      return updated;
    });
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const newImage: CanvasImage = {
            id: `img-${Date.now()}-${Math.random()}`,
            dataUri,
            x: 100 + (canvasImages.length * 50),
            y: 100 + (canvasImages.length * 50),
            width: 300,
            height: (300 * img.height) / img.width,
            selected: false,
            originalWidth: img.width,
            originalHeight: img.height
          };
          const updatedImages = [...canvasImages, newImage];
          setCanvasImages(updatedImages);
          saveCanvasToSession(updatedImages);
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Handle drag and drop from outside
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const dropX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
          const dropY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

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
          setCanvasImages(prev => {
            const updated = [...prev, newImage];
            saveCanvasToSession(updated);
            return updated;
          });
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    });
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
    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (resizingImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

      setCanvasImages(prev => prev.map(img => {
        if (img.id === resizingImage) {
          const newWidth = Math.max(50, img.width + dx);
          const aspectRatio = img.originalHeight / img.originalWidth;
          return {
            ...img,
            width: newWidth,
            height: newWidth * aspectRatio
          };
        }
        return img;
      }));

      setDragStart({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
    } else if (draggedImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

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
    } else if (isSelecting && selectionBox) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const endX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
      const endY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

      setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);

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
    }
  };

  const handleMouseUp = () => {
    // Save canvas if we were dragging or resizing
    if (draggedImage || resizingImage) {
      saveCanvasToSession(canvasImages);
    }

    setDraggedImage(null);
    setResizingImage(null);
    setIsSelecting(false);
    setSelectionBox(null);
    setIsPanning(false);
    setDragStart(null);
  };

  // Delete selected images
  const handleDeleteSelected = () => {
    setCanvasImages(prev => {
      const updated = prev.filter(img => !img.selected);
      saveCanvasToSession(updated);
      return updated;
    });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));

  // Scroll to zoom - use native event listener to prevent passive listener warning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasImages]);

  const selectedCount = canvasImages.filter(img => img.selected).length;

  return (
    <div className="h-full w-full flex bg-white dark:bg-black">
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />
      {/* Left Sidebar - Session & History */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-orange-500" size={20} />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Mixboard</h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded font-medium">
              Beta
            </span>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Sessions</h4>
          <button
            onClick={() => onCreateSession && onCreateSession()}
            className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {allSessions.map(session => (
            <div
              key={session.session_id}
              className={`group px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 ${
                currentSession?.session_id === session.session_id
                  ? 'bg-orange-50 dark:bg-orange-950/30'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {editingSessionId === session.session_id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingSessionTitle}
                    onChange={(e) => setEditingSessionTitle(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        StorageService.renameSession(session.session_id, editingSessionTitle);
                        setEditingSessionId(null);
                        // Update the session in the parent component
                        const updatedSession = { ...session, title: editingSessionTitle };
                        onSessionUpdate(updatedSession as MixboardSession);
                      } else if (e.key === 'Escape') {
                        setEditingSessionId(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      StorageService.renameSession(session.session_id, editingSessionTitle);
                      setEditingSessionId(null);
                      const updatedSession = { ...session, title: editingSessionTitle };
                      onSessionUpdate(updatedSession as MixboardSession);
                    }}
                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingSessionId(null)}
                    className="p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onSelectSession(session.session_id)}
                    className="flex-1 text-left text-xs text-zinc-900 dark:text-zinc-100 truncate"
                  >
                    {session.title}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingSessionId(session.session_id);
                        setEditingSessionTitle(session.title);
                      }}
                      className="p-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (session.generations.length > 0) {
                          alert('Cannot delete session with generations. Please clear the session first.');
                          return;
                        }
                        if (window.confirm(`Delete session "${session.title}"?`)) {
                          StorageService.deleteSession(session.session_id);
                          // If deleting current session, select another one
                          if (currentSession?.session_id === session.session_id) {
                            const otherSession = allSessions.find(s => s.session_id !== session.session_id);
                            if (otherSession) {
                              onSelectSession(otherSession.session_id);
                            }
                          }
                          // Force a re-render by updating parent
                          window.location.reload();
                        }
                      }}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Export Session */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => {
              if (!currentSession) return;
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
            }}
            className="w-full py-2 px-3 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-700 dark:text-zinc-300 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Export Session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair canvas-background"
          style={{
            backgroundImage: theme === 'dark'
              ? 'radial-gradient(circle, #27272a 1px, transparent 1px)'
              : 'radial-gradient(circle, #e4e4e7 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
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
            <div
              key={image.id}
              className={`absolute cursor-move ${image.selected ? 'ring-4 ring-orange-500' : 'ring-1 ring-zinc-300 dark:ring-zinc-700'}`}
              style={{
                left: `${image.x * zoom + panOffset.x}px`,
                top: `${image.y * zoom + panOffset.y}px`,
                width: `${image.width * zoom}px`,
                height: `${image.height * zoom}px`,
                transformOrigin: 'top left'
              }}
              onMouseDown={(e) => handleImageMouseDown(e, image.id)}
            >
              {image.type === 'text' ? (
                <div
                  className="w-full h-full p-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-auto pointer-events-none"
                  style={{
                    fontSize: `${(image.fontSize || 16) * zoom}px`,
                    lineHeight: '1.5'
                  }}
                >
                  {image.text}
                </div>
              ) : (
                <img
                  src={image.dataUri}
                  alt="Canvas item"
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              )}
              {image.selected && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-nwse-resize" />
              )}
            </div>
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

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ZoomIn size={16} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ZoomOut size={16} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <div className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow text-xs text-zinc-700 dark:text-zinc-300">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Selection Info */}
          {selectedCount > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              <div className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow text-sm text-zinc-700 dark:text-zinc-300">
                {selectedCount} selected
              </div>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}

          {contextMenu.visible && (
            <div
              className="fixed z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg overflow-hidden"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                onClick={handleOpenUploadFromContext}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ImageIcon size={16} />
                Upload image
              </button>
              <button
                onClick={handleAddTextFromContext}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Type size={16} />
                Add text
              </button>
            </div>
          )}
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
      </div>
    </div>
  );
};