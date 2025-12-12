/**
 * Video Utility Functions
 *
 * Handles video thumbnail generation, metadata extraction, and frame capture.
 */

/**
 * Generate thumbnail from video at specified time
 */
export async function generateVideoThumbnail(
  videoSource: string | File,
  seekTime = 0,
  width = 512,
  height = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Handle cross-origin for blob URLs
    if (typeof videoSource === 'string' && !videoSource.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    }

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');

        // Calculate dimensions maintaining aspect ratio
        const videoAspect = video.videoWidth / video.videoHeight;
        let canvasWidth = width;
        let canvasHeight = height;

        if (videoAspect > 1) {
          canvasHeight = width / videoAspect;
        } else {
          canvasWidth = height * videoAspect;
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
        const dataUri = canvas.toDataURL('image/jpeg', 0.85);

        cleanup();
        resolve(dataUri);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const onMetadataLoaded = () => {
      // Clamp seek time to video duration
      const targetTime = Math.min(seekTime, video.duration - 0.1);
      video.currentTime = Math.max(0, targetTime);
    };

    video.addEventListener('loadedmetadata', onMetadataLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // Set video source
    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      video.src = URL.createObjectURL(videoSource);
    }
  });
}

/**
 * Get video dimensions
 */
export async function getVideoDimensions(
  videoSource: string | File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    const onMetadataLoaded = () => {
      const result = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      resolve(result);
    };

    video.addEventListener('loadedmetadata', onMetadataLoaded);
    video.addEventListener('error', onError);

    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      video.src = URL.createObjectURL(videoSource);
    }
  });
}

/**
 * Get video duration in seconds
 */
export async function getVideoDuration(videoSource: string | File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    const onMetadataLoaded = () => {
      const duration = video.duration;
      cleanup();
      resolve(duration);
    };

    video.addEventListener('loadedmetadata', onMetadataLoaded);
    video.addEventListener('error', onError);

    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      video.src = URL.createObjectURL(videoSource);
    }
  });
}

/**
 * Extract frame from video at specific time as image
 */
export async function extractVideoFrame(
  videoSource: string | File,
  time: number,
  format: 'png' | 'jpeg' = 'png',
  quality = 0.92
): Promise<{ dataUri: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    if (typeof videoSource === 'string' && !videoSource.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    }

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(video, 0, 0);
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUri = canvas.toDataURL(mimeType, quality);

        cleanup();
        resolve({
          dataUri,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const onMetadataLoaded = () => {
      const targetTime = Math.min(time, video.duration - 0.1);
      video.currentTime = Math.max(0, targetTime);
    };

    video.addEventListener('loadedmetadata', onMetadataLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      video.src = URL.createObjectURL(videoSource);
    }
  });
}

/**
 * Format duration as MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get video file info
 */
export function getVideoFileInfo(file: File): {
  name: string;
  size: number;
  sizeFormatted: string;
  extension: string;
  mimeType: string;
} {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const sizeInMB = file.size / (1024 * 1024);

  return {
    name: file.name,
    size: file.size,
    sizeFormatted: sizeInMB < 1
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${sizeInMB.toFixed(1)} MB`,
    extension,
    mimeType: file.type || `video/${extension}`,
  };
}

/**
 * Check if video format is supported
 */
export function isVideoFormatSupported(file: File): boolean {
  const supportedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ];

  if (supportedTypes.includes(file.type)) return true;

  // Fallback to extension check
  const ext = file.name.toLowerCase().split('.').pop();
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext || '');
}

/**
 * Create video blob URL
 */
export function createVideoUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke video blob URL
 */
export function revokeVideoUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
