import React, { useRef, useState, useCallback } from 'react';
import { X, Video, Loader2, AlertCircle } from 'lucide-react';
import type { CanvasVideo } from '../types';
import { generateVideoThumbnail, getVideoDimensions, getVideoDuration } from '../utils/videoUtils';

interface VideoUploadPanelProps {
  onVideoLoaded: (video: CanvasVideo) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = '.mp4,.webm,.mov,.avi,.mkv';
const ACCEPTED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_FILE_SIZE_MB = 500; // 500MB limit
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const VideoUploadPanel: React.FC<VideoUploadPanelProps> = ({
  onVideoLoaded,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isValidVideoType = (file: File): boolean => {
    // Check MIME type
    if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
    // Check extension as fallback
    const ext = file.name.toLowerCase().split('.').pop();
    return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);

    // Validate file type
    if (!isValidVideoType(file)) {
      setError('Unsupported video format. Please use MP4, WebM, MOV, AVI, or MKV.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    setIsLoading(true);
    setLoadingProgress('Processing video...');

    try {
      // Create object URL for the video
      const videoUrl = URL.createObjectURL(file);

      // Get video metadata
      setLoadingProgress('Reading video metadata...');
      const dimensions = await getVideoDimensions(videoUrl);
      const duration = await getVideoDuration(videoUrl);

      // Generate thumbnail
      setLoadingProgress('Generating thumbnail...');
      const thumbnailUri = await generateVideoThumbnail(videoUrl, Math.min(1, duration / 2));

      // For smaller videos, store as data URI
      let videoDataUri: string | undefined;
      if (file.size < 50 * 1024 * 1024) { // Only store as data URI if < 50MB
        setLoadingProgress('Processing video data...');
        videoDataUri = await fileToDataUri(file);
      }

      // Determine MIME type
      let mimeType = file.type;
      if (!mimeType) {
        const ext = file.name.toLowerCase().split('.').pop();
        switch (ext) {
          case 'mp4':
            mimeType = 'video/mp4';
            break;
          case 'webm':
            mimeType = 'video/webm';
            break;
          case 'mov':
            mimeType = 'video/quicktime';
            break;
          default:
            mimeType = 'video/mp4';
        }
      }

      // Create canvas video object
      const canvasVideo: CanvasVideo = {
        id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'video',
        videoUrl,
        videoDataUri,
        thumbnailUri,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        duration,
        fps: 30, // Default, could be extracted from video metadata
        x: 0, // Will be set by parent
        y: 0,
        width: Math.min(dimensions.width, 400),
        height: Math.min(dimensions.height, 400),
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        selected: false,
      };

      onVideoLoaded(canvasVideo);
      setLoadingProgress('');
    } catch (err) {
      console.error('Failed to load video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onVideoLoaded]);

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
      if (isValidVideoType(file)) {
        handleFileSelect(file);
      } else {
        setError('Please drop a valid video file (MP4, WebM, MOV, AVI, MKV)');
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
          Video
        </label>
        <span className="text-[10px] text-zinc-500">MP4, WebM, MOV</span>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg transition-all h-32 flex flex-col items-center justify-center overflow-hidden
        ${isLoading
          ? 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/30'
          : isDragging
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
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
          <div className="flex flex-col items-center justify-center text-purple-600 dark:text-purple-400">
            <Loader2 size={24} className="mb-2 animate-spin" />
            <span className="text-xs font-medium">{loadingProgress}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 w-full h-full p-4 text-center">
            <Video size={24} className="mb-2 opacity-40" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block">
              {isDragging ? 'Drop video here' : 'Click or drag to upload'}
            </span>
            <span className="text-[10px] opacity-60 mt-1 block max-w-[140px] leading-tight">
              Max {MAX_FILE_SIZE_MB}MB. Extract frames as images.
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

// Helper function to convert file to data URI
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default VideoUploadPanel;
