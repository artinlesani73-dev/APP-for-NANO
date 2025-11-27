import React, { useEffect, useRef, useState } from 'react';
import { X, Undo, Redo, Square, Circle, Triangle, Minus } from 'lucide-react';

interface ImageEditModalProps {
  isOpen: boolean;
  image: string | null;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

type Tool = 'brush' | 'erase' | 'rectangle' | 'circle' | 'triangle' | 'line';

export const ImageEditModal: React.FC<ImageEditModalProps> = ({ isOpen, image, onClose, onSave }) => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
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

  useEffect(() => {
    if (!isOpen || !image) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      const baseCanvas = baseCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!baseCanvas || !drawCanvas || !previewCanvas) return;

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;
      previewCanvas.width = img.width;
      previewCanvas.height = img.height;

      const baseCtx = baseCanvas.getContext('2d');
      const drawCtx = drawCanvas.getContext('2d');
      if (!baseCtx || !drawCtx) return;

      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.drawImage(img, 0, 0);
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

      // Initialize history with empty state
      const initialState = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
      setHistory([initialState]);
      setHistoryIndex(0);
    };
  }, [image, isOpen]);

  // Get context with willReadFrequently for better performance
  useEffect(() => {
    const drawCanvas = drawCanvasRef.current;
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        // Context is now optimized for frequent reads
      }
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

  if (!isOpen || !image) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Edit Control Image</div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-5">
          <div className="lg:col-span-3 bg-zinc-100 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto max-h-[70vh] flex items-center justify-center">
            <div className="relative max-w-full max-h-[70vh] touch-none">
              <canvas ref={baseCanvasRef} className="block max-w-full max-h-[70vh]" />
              <canvas
                ref={drawCanvasRef}
                className="absolute inset-0 max-w-full max-h-[70vh]"
              />
              <canvas
                ref={previewCanvasRef}
                className="absolute inset-0 max-w-full max-h-[70vh] touch-none"
                style={{ cursor: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrawing}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
              />
              {/* Brush size cursor indicator */}
              {showCursor && cursorPos && drawCanvasRef.current && (tool === 'brush' || tool === 'erase') && (
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
            </div>
          </div>

          <div className="space-y-4">
            {/* Undo/Redo buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
              >
                <Undo size={14} />
                Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
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
                  className={`px-3 py-2 text-xs rounded-lg border transition ${
                    tool === 'brush'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  Brush
                </button>
                <button
                  onClick={() => setTool('erase')}
                  className={`px-3 py-2 text-xs rounded-lg border transition ${
                    tool === 'erase'
                      ? 'bg-amber-500 text-white border-amber-400'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
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
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'line'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  <Minus size={14} />
                  Line
                </button>
                <button
                  onClick={() => setTool('rectangle')}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'rectangle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  <Square size={14} />
                  Rect
                </button>
                <button
                  onClick={() => setTool('circle')}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'circle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  <Circle size={14} />
                  Circle
                </button>
                <button
                  onClick={() => setTool('triangle')}
                  className={`px-3 py-2 text-xs rounded-lg border transition flex items-center justify-center gap-1 ${
                    tool === 'triangle'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                  }`}
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
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                      !fillShape
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    Outline
                  </button>
                  <button
                    onClick={() => setFillShape(true)}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                      fillShape
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                    }`}
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
                className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
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
                  className="w-full"
                />
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{brushSize}px</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Opacity</label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{Math.round(brushOpacity * 100)}%</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm"
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

