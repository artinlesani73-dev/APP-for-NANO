import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Camera,
  Download,
  SkipBack,
  SkipForward,
  Loader2,
  Info,
  Video,
} from 'lucide-react';
import type { CanvasVideo, CanvasImage } from '../types';
import { formatDuration, extractVideoFrame } from '../utils/videoUtils';

interface VideoPlayerModalProps {
  video: CanvasVideo;
  isOpen: boolean;
  onClose: () => void;
  onFrameExtract: (image: Omit<CanvasImage, 'x' | 'y'>) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  isOpen,
  onClose,
  onFrameExtract,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  // Control visibility timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset control visibility timer
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  }, [isPlaying, resetControlsTimeout]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // Handle seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentTime, duration]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    const container = document.getElementById('video-player-container');
    if (!container) return;

    if (!isFullscreen) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  }, [isFullscreen]);

  // Extract current frame
  const extractCurrentFrame = useCallback(async () => {
    const videoSrc = video.videoUrl || video.videoDataUri;
    if (!videoSrc) return;

    setIsExtractingFrame(true);

    try {
      const frame = await extractVideoFrame(videoSrc, currentTime, 'png');

      // Generate thumbnail
      const thumbnailCanvas = document.createElement('canvas');
      const thumbSize = 512;
      thumbnailCanvas.width = thumbSize;
      thumbnailCanvas.height = thumbSize;
      const ctx = thumbnailCanvas.getContext('2d');

      if (ctx) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load frame'));
          img.src = frame.dataUri;
        });

        // Calculate aspect-fit dimensions
        const aspectRatio = frame.width / frame.height;
        let drawWidth = thumbSize;
        let drawHeight = thumbSize;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          drawHeight = thumbSize / aspectRatio;
          offsetY = (thumbSize - drawHeight) / 2;
        } else {
          drawWidth = thumbSize * aspectRatio;
          offsetX = (thumbSize - drawWidth) / 2;
        }

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, thumbSize, thumbSize);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }

      const thumbnailUri = thumbnailCanvas.toDataURL('image/jpeg', 0.85);

      // Create canvas image
      const frameImage: Omit<CanvasImage, 'x' | 'y'> = {
        id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        dataUri: frame.dataUri,
        thumbnailUri,
        width: Math.min(frame.width, 512),
        height: Math.min(frame.height, 512),
        originalWidth: frame.width,
        originalHeight: frame.height,
        selected: false,
      };

      onFrameExtract(frameImage);
    } catch (err) {
      console.error('Failed to extract frame:', err);
    } finally {
      setIsExtractingFrame(false);
    }
  }, [video, currentTime, onFrameExtract]);

  // Download video
  const downloadVideo = useCallback(() => {
    const videoSrc = video.videoUrl || video.videoDataUri;
    if (!videoSrc) return;

    const link = document.createElement('a');
    link.href = videoSrc;
    link.download = video.fileName || 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [video]);

  // Video event handlers
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const handleDurationChange = () => setDuration(videoEl.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);

    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('durationchange', handleDurationChange);
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('ended', handleEnded);
    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('canplay', handleCanPlay);

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('durationchange', handleDurationChange);
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('ended', handleEnded);
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(5);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (!isFullscreen) {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, togglePlay, skip, toggleMute, toggleFullscreen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const videoSrc = video.videoUrl || video.videoDataUri;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div
        id="video-player-container"
        className="bg-zinc-900 rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-5xl flex flex-col overflow-hidden"
        onMouseMove={resetControlsTimeout}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-3">
            <Video size={20} className="text-purple-400" />
            <span className="font-medium text-zinc-200">{video.fileName}</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              {video.mimeType.split('/')[1]?.toUpperCase() || 'VIDEO'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Container */}
        <div
          className="flex-1 relative bg-black flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="max-w-full max-h-full"
            preload="auto"
            playsInline
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={48} className="animate-spin text-white" />
            </div>
          )}

          {/* Play Button Overlay (when paused) */}
          {!isPlaying && !isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <Play size={40} className="text-white ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          className={`bg-zinc-900/95 border-t border-zinc-800 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="h-1 bg-zinc-800 cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-purple-500 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); skip(-10); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                title="Skip back 10s"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); skip(10); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                title="Skip forward 10s"
              >
                <SkipForward size={20} />
              </button>

              {/* Time Display */}
              <span className="text-sm text-zinc-400 ml-2">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Volume */}
              <div className="flex items-center gap-1 group">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-20 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Extract Frame */}
              <button
                onClick={(e) => { e.stopPropagation(); extractCurrentFrame(); }}
                disabled={isExtractingFrame}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors text-zinc-300 text-sm"
                title="Extract current frame as image"
              >
                {isExtractingFrame ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                <span>Extract Frame</span>
              </button>

              {/* Download */}
              <button
                onClick={(e) => { e.stopPropagation(); downloadVideo(); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                title="Download video"
              >
                <Download size={20} />
              </button>

              {/* Info */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                className={`p-2 rounded-lg transition-colors ${
                  showInfo ? 'bg-zinc-700 text-zinc-200' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Video info"
              >
                <Info size={20} />
              </button>

              {/* Fullscreen */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                title="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>

          {/* Info Panel */}
          {showInfo && (
            <div className="px-4 pb-3 pt-0 border-t border-zinc-800 mt-0">
              <div className="grid grid-cols-4 gap-4 text-xs text-zinc-400 pt-3">
                <div>
                  <span className="block text-zinc-500">Duration</span>
                  <span className="text-zinc-300">{formatDuration(duration)}</span>
                </div>
                <div>
                  <span className="block text-zinc-500">Resolution</span>
                  <span className="text-zinc-300">{video.originalWidth} x {video.originalHeight}</span>
                </div>
                <div>
                  <span className="block text-zinc-500">File Size</span>
                  <span className="text-zinc-300">{(video.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div>
                  <span className="block text-zinc-500">Format</span>
                  <span className="text-zinc-300">{video.mimeType}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;
