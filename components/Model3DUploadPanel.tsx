import React, { useRef, useState } from 'react';
import { Cube, UploadCloud, Info } from 'lucide-react';

interface Model3DUploadPanelProps {
  onUpload: (file: File) => void;
  accept?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}

const ACCEPT_DEFAULT = '.ifc,.glb,.gltf,.obj';

export const Model3DUploadPanel: React.FC<Model3DUploadPanelProps> = ({
  onUpload,
  accept = ACCEPT_DEFAULT,
  title = 'Upload 3D Model',
  description = 'Drop IFC, GLB/GLTF, or OBJ files to add them to the canvas.',
  disabled = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    onUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      onUpload(file);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
        <Cube size={18} className="text-blue-500" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Supports IFC, GLB/GLTF, OBJ</span>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer shadow-sm ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <UploadCloud size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {isDragging ? 'Drop model to upload' : 'Click to browse or drag & drop'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">{description}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full">
            <Info size={12} />
            <span>Max file size depends on browser memory limits.</span>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default Model3DUploadPanel;
