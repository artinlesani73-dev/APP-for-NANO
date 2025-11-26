import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ImageEditModalProps {
  isOpen: boolean;
  image: string | null;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

export const ImageEditModal: React.FC<ImageEditModalProps> = ({ isOpen, image, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(6);
  const [brushOpacity, setBrushOpacity] = useState(0.8);

  useEffect(() => {
    if (!isOpen || !image) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }, [image, isOpen]);

  const getContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const ctx = getContext();
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = getContext();
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = brushColor;
    ctx.globalAlpha = brushOpacity;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = getContext();
    if (ctx) {
      ctx.closePath();
      ctx.globalAlpha = 1;
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUri = canvas.toDataURL('image/png');
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
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[70vh] touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </div>

          <div className="space-y-4">
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
                max={40}
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

