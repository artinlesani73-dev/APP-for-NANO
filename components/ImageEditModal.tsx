import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ImageEditModalProps {
  isOpen: boolean;
  image: string | null;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

export const ImageEditModal: React.FC<ImageEditModalProps> = ({ isOpen, image, onClose, onSave }) => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(0.8);
  const [tool, setTool] = useState<'brush' | 'erase'>('brush');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showCursor, setShowCursor] = useState(false);

  const getPointerPosition = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

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
      if (!baseCanvas || !drawCanvas) return;

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      drawCanvas.width = img.width;
      drawCanvas.height = img.height;

      const baseCtx = baseCanvas.getContext('2d');
      const drawCtx = drawCanvas.getContext('2d');
      if (!baseCtx || !drawCtx) return;

      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.drawImage(img, 0, 0);
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    };
  }, [image, isOpen]);

  const getContext = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawCanvasRef.current) return;
    const ctx = getContext();
    if (!ctx) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    drawCanvasRef.current.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    ctx.beginPath();
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'erase' ? '#000000' : brushColor;
    ctx.globalAlpha = tool === 'erase' ? 1 : brushOpacity;
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Update cursor position for visual indicator
    const canvas = drawCanvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    if (!isDrawing || !drawCanvasRef.current) return;
    const ctx = getContext();
    if (!ctx) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'erase' ? '#000000' : brushColor;
    ctx.globalAlpha = tool === 'erase' ? 1 : brushOpacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
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
    if (e && drawCanvasRef.current?.hasPointerCapture(e.pointerId)) {
      drawCanvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    const ctx = getContext();
    if (ctx) {
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
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
                className="absolute inset-0 max-w-full max-h-[70vh] touch-none"
                style={{ cursor: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrawing}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
              />
              {/* Brush size cursor indicator */}
              {showCursor && cursorPos && drawCanvasRef.current && (
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTool('brush')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition ${
                  tool === 'brush'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                Brush
              </button>
              <button
                onClick={() => setTool('erase')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition ${
                  tool === 'erase'
                    ? 'bg-amber-500 text-white border-amber-400'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                Eraser
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Brush Color</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-full h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
              />
            </div>

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

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Brush Opacity</label>
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

