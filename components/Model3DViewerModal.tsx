import React, { useEffect, useState } from 'react';
import { X, Camera, RefreshCcw, Grid, Axis3D, Palette, Eye, MoveRight } from 'lucide-react';
import { Canvas3DModel } from '../types';
import { Model3DCanvas } from './Model3DCanvas';

interface Model3DViewerModalProps {
  isOpen: boolean;
  model: Canvas3DModel | null;
  onClose: () => void;
  onCaptureScreenshot?: () => void;
  onResetView?: () => void;
}

export const Model3DViewerModal: React.FC<Model3DViewerModalProps> = ({
  isOpen,
  model,
  onClose,
  onCaptureScreenshot,
  onResetView
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [modelColor, setModelColor] = useState('#808080');
  const [backgroundColor, setBackgroundColor] = useState('#0f172a');
  const [useOriginalColors, setUseOriginalColors] = useState(true);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !model) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-950 text-zinc-100 rounded-2xl shadow-2xl border border-zinc-800 w-[90vw] h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-black/60">
          <div>
            <p className="text-sm font-semibold">3D Model Viewer</p>
            <p className="text-xs text-zinc-400 truncate max-w-md">{model.fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-200"
            aria-label="Close 3D viewer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-12 h-[calc(100%-48px)]">
          <div className="col-span-8 h-full p-4">
            <Model3DCanvas
              previewImage={model.thumbnailUri}
              backgroundColor={backgroundColor}
              onResetView={onResetView}
              onCaptureScreenshot={onCaptureScreenshot}
            >
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-lg text-[11px] text-zinc-200 border border-white/10">
                <Grid size={14} className={showGrid ? 'text-blue-400' : 'text-zinc-500'} />
                <Axis3D size={14} className={showAxes ? 'text-blue-400' : 'text-zinc-500'} />
                <Eye size={14} className={showWireframe ? 'text-blue-400' : 'text-zinc-500'} />
              </div>
            </Model3DCanvas>
          </div>

          <div className="col-span-4 border-l border-zinc-800 h-full bg-black/40 p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">View Presets</p>
              <div className="flex gap-2">
                <button
                  onClick={onResetView}
                  className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1"
                >
                  <RefreshCcw size={14} />
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom', 'Iso'].map((label) => (
                <button
                  key={label}
                  className="py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600"
                  onClick={() => console.log(`[3D] View preset selected: ${label}`)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-100">Display</p>
              <div className="flex flex-col gap-2 text-sm text-zinc-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="flex items-center gap-2">
                    <Grid size={14} /> Grid Helper
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showAxes}
                    onChange={(e) => setShowAxes(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="flex items-center gap-2">
                    <Axis3D size={14} /> Axes Helper
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showWireframe}
                    onChange={(e) => setShowWireframe(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="flex items-center gap-2">
                    <Eye size={14} /> Wireframe
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-100">Appearance</p>
              <div className="flex items-center justify-between text-sm text-zinc-200">
                <div className="flex items-center gap-2">
                  <Palette size={14} />
                  <span>Model Color</span>
                </div>
                <input
                  type="color"
                  value={modelColor}
                  onChange={(e) => setModelColor(e.target.value)}
                  className="w-12 h-8 bg-transparent border border-zinc-700 rounded"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={useOriginalColors}
                  onChange={(e) => setUseOriginalColors(e.target.checked)}
                  className="accent-blue-500"
                />
                <span>Use original materials</span>
              </label>
              <div className="flex items-center justify-between text-sm text-zinc-200">
                <div className="flex items-center gap-2">
                  <Palette size={14} />
                  <span>Background</span>
                </div>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-8 bg-transparent border border-zinc-700 rounded"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-100">Screenshot</p>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Camera size={14} />
                <span>Clean capture hides helpers automatically.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCaptureScreenshot}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white shadow"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Camera size={16} />
                    Take Screenshot
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-100">Model Info</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className="text-zinc-500">Type</p>
                  <p className="font-semibold uppercase tracking-wide">{model.modelType}</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className="text-zinc-500">File Size</p>
                  <p className="font-semibold">{(model.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {model.vertexCount && (
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 col-span-2">
                    <p className="text-zinc-500">Vertices</p>
                    <p className="font-semibold">{model.vertexCount.toLocaleString()}</p>
                  </div>
                )}
                {model.boundingBox && (
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 col-span-2">
                    <p className="text-zinc-500">Bounding Box</p>
                    <p className="font-semibold flex items-center gap-2">
                      <MoveRight size={14} />
                      {`X: ${model.boundingBox.min.x.toFixed(2)} → ${model.boundingBox.max.x.toFixed(2)}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Model3DViewerModal;
