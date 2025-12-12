import React, { useRef, useState, useCallback } from 'react';
import { X, Box, Loader2, AlertCircle } from 'lucide-react';
import type { Canvas3DModel, Model3DType } from '../types';
import { detectModelType, loadModel, generateModelThumbnail, fileToDataUri } from '../utils/model3DLoaders';

interface Model3DUploadPanelProps {
  onModelLoaded: (model: Canvas3DModel) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = '.glb,.gltf,.obj';
const MAX_FILE_SIZE_MB = 50; // 50MB recommended limit
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const Model3DUploadPanel: React.FC<Model3DUploadPanelProps> = ({
  onModelLoaded,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);

    // Validate file type
    const modelType = detectModelType(file.name);
    if (!modelType) {
      setError('Unsupported file type. Please use GLB, GLTF, or OBJ files.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    setIsLoading(true);
    setLoadingProgress('Loading model...');

    try {
      // Load the 3D model
      setLoadingProgress('Parsing 3D model...');
      const result = await loadModel(file);

      // Generate thumbnail
      setLoadingProgress('Generating preview...');
      const thumbnailUri = await generateModelThumbnail(result.scene);

      // Convert to data URI for storage (only for smaller files)
      let modelDataUri: string | undefined;
      if (file.size < 10 * 1024 * 1024) { // Only store as data URI if < 10MB
        setLoadingProgress('Processing file...');
        modelDataUri = await fileToDataUri(file);
      }

      // Create canvas model object
      const canvasModel: Canvas3DModel = {
        id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: '3d-model',
        modelType: modelType as Model3DType,
        modelDataUri,
        thumbnailUri,
        fileName: file.name,
        fileSize: file.size,
        x: 0, // Will be set by parent
        y: 0,
        width: 256,
        height: 256,
        originalWidth: 256,
        originalHeight: 256,
        selected: false,
        vertexCount: result.vertexCount,
        faceCount: result.faceCount,
        boundingBox: result.boundingBox,
        defaultCameraPosition: {
          x: result.center.x + result.size.x,
          y: result.center.y + result.size.y * 0.5,
          z: result.center.z + result.size.z,
        },
        defaultCameraTarget: result.center,
      };

      onModelLoaded(canvasModel);
      setLoadingProgress('');
    } catch (err) {
      console.error('Failed to load 3D model:', err);
      setError(err instanceof Error ? err.message : 'Failed to load 3D model');
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onModelLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isLoading) {
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

    if (disabled || isLoading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const modelType = detectModelType(file.name);
      if (modelType) {
        handleFileSelect(file);
      } else {
        setError('Please drop a GLB, GLTF, or OBJ file');
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !isLoading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          3D Model
        </label>
        <span className="text-[10px] text-zinc-500">GLB, GLTF, OBJ</span>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg transition-all h-32 flex flex-col items-center justify-center overflow-hidden
        ${isLoading
          ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30'
          : isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : disabled
              ? 'border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30 cursor-not-allowed opacity-50'
              : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400">
            <Loader2 size={24} className="mb-2 animate-spin" />
            <span className="text-xs font-medium">{loadingProgress}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 w-full h-full p-4 text-center">
            <Box size={24} className="mb-2 opacity-40" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block">
              {isDragging ? 'Drop 3D model here' : 'Click or drag to upload'}
            </span>
            <span className="text-[10px] opacity-60 mt-1 block max-w-[140px] leading-tight">
              Max {MAX_FILE_SIZE_MB}MB. Take screenshots of 3D views.
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          style={{ display: 'none' }}
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          disabled={disabled || isLoading}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:bg-red-100 dark:hover:bg-red-900/50 p-0.5 rounded"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Model3DUploadPanel;
