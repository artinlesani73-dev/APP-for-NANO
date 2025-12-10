import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Undo, Redo, Square, Circle, Triangle, Minus, AlertCircle, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface ImageEditModalProps {
  isOpen: boolean;
  image: string | null;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

type Tool = 'brush' | 'erase' | 'rectangle' | 'circle' | 'triangle' | 'line';

// Resize handle positions
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const ImageEditModal: React.FC<ImageEditModalProps> = ({ isOpen, image, onClose, onSave }) => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(0.8);
  const [tool, setTool] = useState<Tool>('brush');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [fillShape, setFillShape] = useState(false);
  const [shapeThickness, setShapeThickness] = useState(3);

  // Image loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number } | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Resizable modal state
  const [modalSize, setModalSize] = useState({ width: 900, height: 700 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeSize, setPreMaximizeSize] = useState({ width: 900, height: 700 });

  // Log when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[ImageEditModal] Modal opened:', {
        hasImage: !!image,
        imageLength: image?.length,
        imagePrefix: image?.substring(0, 50)
      });
    }
  }, [isOpen, image]);

  const getPointerPosition = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const drawCanvas = drawCanvasRef.current;
    if (!canvas || !drawCanvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Image loading effect with error handling
  useEffect(() => {
    if (!isOpen || !image) {
      setIsLoading(false);
      setLoadError(null);
      setImageInfo(null);
      return;
    }

    console.log('[ImageEditModal] Starting image load...');
    setIsLoading(true);
    setLoadError(null);
    setImageInfo(null);

    const img = new Image();

    img.onload = () => {
      console.log('[ImageEditModal] Image loaded successfully:', {
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });

      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;

      if (!baseCanvas || !drawCanvas || !previewCanvas) {
        console.error('[ImageEditModal] Canvas refs not available');
        setLoadError('Canvas initialization failed');
        setIsLoading(false);
        return;
      }

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;
      previewCanvas.width = img.width;
      previewCanvas.height = img.height;

      const baseCtx = baseCanvas.getContext('2d');
      const drawCtx = drawCanvas.getContext('2d');

      if (!baseCtx || !drawCtx) {
        console.error('[ImageEditModal] Failed to get canvas contexts');
        setLoadError('Canvas context initialization failed');
        setIsLoading(false);
        return;
      }

      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.drawImage(img, 0, 0);
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

      // Initialize history with empty state
      const initialState = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      setHistory([initialState]);
      setHistoryIndex(0);
      setImageInfo({ width: img.width, height: img.height });
      setIsLoading(false);

      console.log('[ImageEditModal] Canvas initialized successfully');
    };

    img.onerror = (error) => {
      console.error('[ImageEditModal] Image failed to load:', error);
      console.error('[ImageEditModal] Image source (first 100 chars):', image.substring(0, 100));

      // Provide specific error messages
      let errorMessage = 'Failed to load image';
      if (!image.startsWith('data:')) {
        errorMessage = 'Invalid image format - expected data URI';
      } else if (image.length < 100) {
        errorMessage = 'Image data appears to be truncated or empty';
      }

      setLoadError(errorMessage);
      setIsLoading(false);
    };

    // Set crossOrigin for potential CORS issues
    img.crossOrigin = 'anonymous';
    img.src = image;

    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [image, isOpen]);

  // Get context with willReadFrequently for better performance
  useEffect(() => {
    const drawCanvas = drawCanvasRef.current;
    if (drawCanvas) {
      drawCanvas.getContext('2d', { willReadFrequently: true });
    }
  }, []);

  const getContext = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { willReadFrequently: true });
  };

  const saveToHistory = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const drawShape = (ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
    ctx.strokeStyle = brushColor;
    ctx.fillStyle = brushColor;
    ctx.lineWidth = shapeThickness;
    ctx.globalAlpha = brushOpacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (tool) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;

      case 'rectangle': {
        const width = end.x - start.x;
        const height = end.y - start.y;
        if (fillShape) {
          ctx.fillRect(start.x, start.y, width, height);
        } else {
          ctx.strokeRect(start.x, start.y, width, height);
        }
        break;
      }

      case 'circle': {
        const radiusX = Math.abs(end.x - start.x) / 2;
        const radiusY = Math.abs(end.y - start.y) / 2;
        const centerX = start.x + (end.x - start.x) / 2;
        const centerY = start.y + (end.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (fillShape) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        break;
      }

      case 'triangle': {
        const topX = (start.x + end.x) / 2;
        const topY = start.y;
        const bottomLeftX = start.x;
        const bottomLeftY = end.y;
        const bottomRightX = end.x;
        const bottomRightY = end.y;

        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(bottomLeftX, bottomLeftY);
        ctx.lineTo(bottomRightX, bottomRightY);
        ctx.closePath();

        if (fillShape) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        break;
      }
    }

    ctx.globalAlpha = 1;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const ctx = getContext();
    if (!ctx || !canvas) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setStartPos(pos);

    if (tool === 'brush' || tool === 'erase') {
      ctx.beginPath();
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = tool === 'erase' ? '#000000' : brushColor;
      ctx.globalAlpha = tool === 'erase' ? 1 : brushOpacity;
      ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    if (!isDrawing) return;
    const pos = getPointerPosition(e);
    if (!pos) return;

    if (tool === 'brush' || tool === 'erase') {
      const ctx = getContext();
      if (!ctx) return;

      ctx.lineWidth = brushSize;
      ctx.strokeStyle = tool === 'erase' ? '#000000' : brushColor;
      ctx.globalAlpha = tool === 'erase' ? 1 : brushOpacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas || !startPos) return;
      const previewCtx = previewCanvas.getContext('2d');
      if (!previewCtx) return;

      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      drawShape(previewCtx, startPos, pos);
    }
  };

  const handlePointerEnter = () => {
    setShowCursor(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setShowCursor(false);
    setCursorPos(null);
    stopDrawing(e);
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e) {
      const canvas = e.currentTarget;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    if (tool !== 'brush' && tool !== 'erase' && startPos && e) {
      const pos = getPointerPosition(e);
      if (pos) {
        const ctx = getContext();
        if (ctx) {
          drawShape(ctx, startPos, pos);
        }

        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
          const previewCtx = previewCanvas.getContext('2d');
          if (previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
          }
        }
      }
    }

    setIsDrawing(false);
    setStartPos(null);

    const ctx = getContext();
    if (ctx) {
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    saveToHistory();
  };

  const handleSave = () => {
    const baseCanvas = baseCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!baseCanvas || !drawCanvas) {
      console.error('[ImageEditModal] Cannot save - canvas refs not available');
      return;
    }

    console.log('[ImageEditModal] Saving edited image...');

    const merged = document.createElement('canvas');
    merged.width = baseCanvas.width;
    merged.height = baseCanvas.height;
    const ctx = merged.getContext('2d');
    if (!ctx) {
      console.error('[ImageEditModal] Cannot save - failed to get merge canvas context');
      return;
    }

    ctx.drawImage(baseCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);

    const dataUri = merged.toDataURL('image/png');
    console.log('[ImageEditModal] Image saved, dataUri length:', dataUri.length);

    onSave(dataUri);
    onClose();
  };

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height
    });
  }, [modalSize]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      // Minimum sizes
      const minWidth = 600;
      const minHeight = 500;
      const maxWidth = window.innerWidth - 40;
      const maxHeight = window.innerHeight - 40;

      if (resizeHandle?.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStart.width + deltaX));
      }
      if (resizeHandle?.includes('w')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStart.width - deltaX));
      }
      if (resizeHandle?.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStart.height + deltaY));
      }
      if (resizeHandle?.includes('n')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStart.height - deltaY));
      }

      setModalSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeHandle, resizeStart]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setModalSize(preMaximizeSize);
      setIsMaximized(false);
    } else {
      setPreMaximizeSize(modalSize);
      setModalSize({
        width: window.innerWidth - 40,
        height: window.innerHeight - 40
      });
      setIsMaximized(true);
    }
  };

  if (!isOpen || !image) return null;

  // Calculate canvas container height based on modal size
  const canvasContainerHeight = modalSize.height - 120; // Account for header and padding

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative"
        style={{
          width: modalSize.width,
          height: modalSize.height,
          maxWidth: '100vw',
          maxHeight: '100vh'
        }}
      >
        {/* Resize handles */}
        {!isMaximized && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:bg-blue-500/20 z-10"
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-blue-500/20 z-10"
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div
              className="absolute top-0 bottom-0 left-0 w-2 cursor-w-resize hover:bg-blue-500/20 z-10"
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div
              className="absolute top-0 bottom-0 right-0 w-2 cursor-e-resize hover:bg-blue-500/20 z-10"
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
            <div
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize hover:bg-blue-500/20 z-20"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div
              className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize hover:bg-blue-500/20 z-20"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize hover:bg-blue-500/20 z-20"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize hover:bg-blue-500/20 z-20"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
          </>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Edit Image</div>
            {imageInfo && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {imageInfo.width} x {imageInfo.height}px
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMaximize}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-5 h-[calc(100%-56px)]">
          {/* Canvas area */}
          <div
            className="lg:col-span-3 bg-zinc-100 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto flex items-center justify-center"
            style={{ height: canvasContainerHeight }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
                <Loader2 size={32} className="animate-spin" />
                <p className="text-sm">Loading image...</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-3 text-red-500 dark:text-red-400 p-6 text-center">
                <AlertCircle size={48} />
                <div>
                  <p className="font-semibold">Failed to load image</p>
                  <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">{loadError}</p>
                  <p className="text-xs mt-2 text-zinc-400 dark:text-zinc-500">
                    Check the browser console for more details
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative touch-none" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                <canvas
                  ref={baseCanvasRef}
                  className="block"
                  style={{ maxWidth: '100%', maxHeight: canvasContainerHeight - 20 }}
                />
                <canvas
                  ref={drawCanvasRef}
                  className="absolute inset-0"
                  style={{ maxWidth: '100%', maxHeight: canvasContainerHeight - 20 }}
                />
                <canvas
                  ref={previewCanvasRef}
                  className="absolute inset-0 touch-none"
                  style={{ cursor: 'none', maxWidth: '100%', maxHeight: canvasContainerHeight - 20 }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={stopDrawing}
                  onPointerEnter={handlePointerEnter}
                  onPointerLeave={handlePointerLeave}
                />
                {/* Cursor indicator */}
                {showCursor && cursorPos && drawCanvasRef.current && (
                  <>
                    {(tool === 'brush' || tool === 'erase') && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: cursorPos.x,
                          top: cursorPos.y,
                          transform: 'translate(-50%, -50%)',
                          width: brushSize * (drawCanvasRef.current.getBoundingClientRect().width / drawCanvasRef.current.width),
                          height: brushSize * (drawCanvasRef.current.getBoundingClientRect().height / drawCanvasRef.current.height),
                          borderRadius: '50%',
                          border: `2px solid ${tool === 'erase' ? '#f59e0b' : '#3b82f6'}`,
                          backgroundColor: tool === 'erase'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : `${brushColor}${Math.round(brushOpacity * 255).toString(16).padStart(2, '0')}`,
                          mixBlendMode: 'normal'
                        }}
                      />
                    )}
                    {(tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'triangle') && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: cursorPos.x,
                          top: cursorPos.y,
                          transform: 'translate(-50%, -50%)',
                          width: 20,
                          height: 20
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20">
                          <line x1="10" y1="0" x2="10" y2="20" stroke="#3b82f6" strokeWidth="2" />
                          <line x1="0" y1="10" x2="20" y2="10" stroke="#3b82f6" strokeWidth="2" />
                        </svg>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tools panel */}
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: canvasContainerHeight }}>
            {/* Undo/Redo buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0 || isLoading || !!loadError}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
              >
                <Undo size={14} />
                Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1 || isLoading || !!loadError}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
              >
                <Redo size={14} />
                Redo
              </button>
            </div>

            {/* Drawing tools */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Tools</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTool('brush')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition ${
                    tool === 'brush'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  Brush
                </button>
                <button
                  onClick={() => setTool('erase')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition ${
                    tool === 'erase'
                      ? 'bg-amber-500 text-white border-amber-400'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  Eraser
                </button>
              </div>
            </div>

            {/* Shape tools */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Shapes</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTool('line')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'line'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  <Minus size={14} />
                  Line
                </button>
                <button
                  onClick={() => setTool('rectangle')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'rectangle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  <Square size={14} />
                  Rect
                </button>
                <button
                  onClick={() => setTool('circle')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'circle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  <Circle size={14} />
                  Circle
                </button>
                <button
                  onClick={() => setTool('triangle')}
                  disabled={isLoading || !!loadError}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'triangle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  } disabled:opacity-50`}
                >
                  <Triangle size={14} />
                  Triangle
                </button>
              </div>
            </div>

            {/* Shape options */}
            {tool !== 'brush' && tool !== 'erase' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Shape Style</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFillShape(false)}
                    disabled={isLoading || !!loadError}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                      !fillShape
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                    } disabled:opacity-50`}
                  >
                    Outline
                  </button>
                  <button
                    onClick={() => setFillShape(true)}
                    disabled={isLoading || !!loadError}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                      fillShape
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                    } disabled:opacity-50`}
                  >
                    Filled
                  </button>
                </div>
              </div>
            )}

            {/* Thickness control for shapes */}
            {tool !== 'brush' && tool !== 'erase' && !fillShape && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Line Thickness</label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={shapeThickness}
                  onChange={(e) => setShapeThickness(Number(e.target.value))}
                  disabled={isLoading || !!loadError}
                  className="w-full"
                />
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{shapeThickness}px</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Color</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                disabled={isLoading || !!loadError}
                className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
              />
            </div>

            {/* Brush size */}
            {(tool === 'brush' || tool === 'erase') && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Brush Size</label>
                <input
                  type="range"
                  min={1}
                  max={72}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  disabled={isLoading || !!loadError}
                  className="w-full"
                />
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{brushSize}px</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !!loadError}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Drawing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
