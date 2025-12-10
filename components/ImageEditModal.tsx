import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Undo, Redo, Square, Circle, Triangle, Minus, Loader2, AlertCircle } from 'lucide-react';

interface ImageEditModalProps {
  isOpen: boolean;
  image: string | null;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

type Tool = 'brush' | 'erase' | 'rectangle' | 'circle' | 'triangle' | 'line';

interface ModalSize {
  width: number;
  height: number;
}

const MIN_MODAL_WIDTH = 600;
const MIN_MODAL_HEIGHT = 400;
const DEFAULT_MODAL_WIDTH = 900;
const DEFAULT_MODAL_HEIGHT = 600;

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

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Modal size states (resizable only, no maximize)
  const [modalSize, setModalSize] = useState<ModalSize>({ width: DEFAULT_MODAL_WIDTH, height: DEFAULT_MODAL_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<string | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen && image) {
      setIsLoading(true);
      setLoadError(null);
      setImageDimensions(null);
    } else if (!isOpen) {
      // Reset states when closing
      setIsLoading(true);
      setLoadError(null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [isOpen, image]);

  // Load image with error handling
  useEffect(() => {
    if (!isOpen || !image) return;

    setIsLoading(true);
    setLoadError(null);

    const img = new Image();

    img.onload = () => {
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!baseCanvas || !drawCanvas || !previewCanvas) {
        setLoadError('Failed to initialize canvas elements');
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
        setLoadError('Failed to get canvas context');
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
      setImageDimensions({ width: img.width, height: img.height });
      setIsLoading(false);
    };

    img.onerror = () => {
      setLoadError('Failed to load image. The image data may be corrupted or missing.');
      setIsLoading(false);
    };

    img.src = image;
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

    // For brush and eraser, start path immediately
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
    // Update cursor position for visual indicator
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

    // For brush and eraser, continue drawing path
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
      // For shapes, draw preview on preview canvas
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas || !startPos) return;
      const previewCtx = previewCanvas.getContext('2d');
      if (!previewCtx) return;

      // Clear preview canvas
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

      // Draw shape preview
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

    // For shapes, finalize the drawing on the draw canvas
    if (tool !== 'brush' && tool !== 'erase' && startPos && e) {
      const pos = getPointerPosition(e);
      if (pos) {
        const ctx = getContext();
        if (ctx) {
          drawShape(ctx, startPos, pos);
        }

        // Clear preview canvas
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

    // Save to history after drawing is complete
    saveToHistory();
  };

  const handleSave = () => {
    const baseCanvas = baseCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!baseCanvas || !drawCanvas) return;

    const merged = document.createElement('canvas');
    merged.width = baseCanvas.width;
    merged.height = baseCanvas.height;
    const ctx = merged.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(baseCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);

    const dataUri = merged.toDataURL('image/png');
    onSave(dataUri);
    onClose();
  };

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeEdge(edge);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height
    };
  }, [modalSize]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing || !resizeEdge) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      if (resizeEdge.includes('e')) {
        newWidth = Math.max(MIN_MODAL_WIDTH, resizeStartRef.current.width + deltaX * 2);
      }
      if (resizeEdge.includes('w')) {
        newWidth = Math.max(MIN_MODAL_WIDTH, resizeStartRef.current.width - deltaX * 2);
      }
      if (resizeEdge.includes('s')) {
        newHeight = Math.max(MIN_MODAL_HEIGHT, resizeStartRef.current.height + deltaY * 2);
      }
      if (resizeEdge.includes('n')) {
        newHeight = Math.max(MIN_MODAL_HEIGHT, resizeStartRef.current.height - deltaY * 2);
      }

      // Constrain to viewport
      const maxWidth = window.innerWidth - 48;
      const maxHeight = window.innerHeight - 48;
      newWidth = Math.min(newWidth, maxWidth);
      newHeight = Math.min(newHeight, maxHeight);

      setModalSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeEdge(null);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeEdge]);

  if (!isOpen || !image) return null;

  // Calculate canvas container height based on modal size
  const headerHeight = 52;
  const padding = 40;
  const canvasContainerHeight = `${modalSize.height - headerHeight - padding}px`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative ${isResizing ? 'select-none' : ''}`}
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Edit Image</div>
            {imageDimensions && !isLoading && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {imageDimensions.width} x {imageDimensions.height}px
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div
            className="flex-1 bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-auto flex items-center justify-center p-4"
            style={{ height: canvasContainerHeight }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
                <Loader2 size={32} className="animate-spin" />
                <span className="text-sm">Loading image...</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-3 text-red-500 max-w-md text-center p-4">
                <AlertCircle size={32} />
                <span className="text-sm font-medium">Failed to load image</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{loadError}</span>
                <button
                  onClick={onClose}
                  className="mt-2 px-4 py-2 text-sm rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="relative touch-none" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                <canvas
                  ref={baseCanvasRef}
                  className="block"
                  style={{ maxWidth: '100%', maxHeight: `${modalSize.height - headerHeight - padding - 20}px` }}
                />
                <canvas
                  ref={drawCanvasRef}
                  className="absolute inset-0"
                  style={{ maxWidth: '100%', maxHeight: `${modalSize.height - headerHeight - padding - 20}px` }}
                />
                <canvas
                  ref={previewCanvasRef}
                  className="absolute inset-0 touch-none"
                  style={{
                    cursor: 'none',
                    maxWidth: '100%',
                    maxHeight: `${modalSize.height - headerHeight - padding - 20}px`
                  }}
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
                          mixBlendMode: tool === 'erase' ? 'normal' : 'normal'
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

          {/* Toolbar */}
          <div className="w-52 p-4 space-y-4 overflow-y-auto shrink-0">
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Triangle size={14} />
                  Triangle
                </button>
              </div>
            </div>

            {/* Shape options - only show for shape tools */}
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
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  className="w-full disabled:opacity-50"
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
                className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-50"
              />
            </div>

            {/* Brush size - only show for brush and eraser */}
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
                  className="w-full disabled:opacity-50"
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

        {/* Resize handles */}
        <>
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          {/* Edge handles */}
          <div
            className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className="absolute left-0 top-4 bottom-4 w-2 cursor-ew-resize"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div
            className="absolute right-0 top-4 bottom-4 w-2 cursor-ew-resize"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
        </>
      </div>
    </div>
  );
};
