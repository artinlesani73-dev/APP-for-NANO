import React from 'react';

interface Model3DCanvasProps {
  previewImage?: string;
  title?: string;
  helperText?: string;
  backgroundColor?: string;
  onResetView?: () => void;
  onCaptureScreenshot?: () => void;
  children?: React.ReactNode;
}

export const Model3DCanvas: React.FC<Model3DCanvasProps> = ({
  previewImage,
  title = '3D Viewport',
  helperText = 'Orbit: Drag • Pan: Shift + Drag • Zoom: Scroll',
  backgroundColor = '#0f172a',
  onResetView,
  onCaptureScreenshot,
  children
}) => {
  return (
    <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 text-zinc-100 text-xs border-b border-zinc-800">
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-[11px] text-zinc-400">{helperText}</span>
        </div>
        <div className="flex items-center gap-2">
          {onResetView && (
            <button
              onClick={onResetView}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700 border border-zinc-700"
            >
              Reset View
            </button>
          )}
          {onCaptureScreenshot && (
            <button
              onClick={onCaptureScreenshot}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-500 shadow-sm"
            >
              Capture Screenshot
            </button>
          )}
        </div>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center"
        style={{ background: backgroundColor }}
      >
        {previewImage ? (
          <img src={previewImage} alt="3D preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-center text-zinc-300 text-sm space-y-2">
            <div className="text-3xl">🧊</div>
            <p className="font-medium">3D model viewport placeholder</p>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Add Three.js rendering here to display IFC/GLB/OBJ models. Controls will overlay on top of this region.
            </p>
          </div>
        )}

        {children && (
          <div className="absolute inset-0 pointer-events-none">{children}</div>
        )}
      </div>
    </div>
  );
};

export default Model3DCanvas;
