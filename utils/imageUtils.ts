/**
 * Image utility functions for canvas thumbnail generation
 * Used to optimize canvas performance by creating lightweight thumbnails
 * while preserving original images for API requests
 */

/**
 * Generate a thumbnail from a full-size image data URI
 *
 * @param dataUri - Full-size image data URI (e.g., "data:image/png;base64,...")
 * @param maxDimension - Maximum width or height in pixels (default 512px)
 * @param quality - JPEG quality from 0 to 1 (default 0.85)
 * @returns Promise resolving to thumbnail data URI
 *
 * @example
 * const thumbnail = await generateThumbnail(originalImage, 512, 0.85);
 */
export async function generateThumbnail(
  dataUri: string,
  maxDimension: number = 512,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        const originalSize = estimateDataUriSize(dataUri);
        console.log(`[Thumbnail] Original: ${width}x${height}, ${(originalSize / 1024 / 1024).toFixed(2)}MB`);

        // Only resize if image is larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            // Landscape orientation
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            // Portrait or square orientation
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas 2D context'));
          return;
        }

        // Use high-quality image smoothing for better thumbnail quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Determine output format
        // Use PNG for images with transparency, JPEG for others (better compression)
        const isPNG = dataUri.toLowerCase().includes('data:image/png');
        const format = isPNG ? 'image/png' : 'image/jpeg';

        // Export thumbnail
        const thumbnailUri = canvas.toDataURL(format, quality);

        const thumbnailSize = estimateDataUriSize(thumbnailUri);
        const reduction = ((1 - thumbnailSize / originalSize) * 100).toFixed(1);
        console.log(`[Thumbnail] Generated: ${Math.round(width)}x${Math.round(height)}, ${(thumbnailSize / 1024 / 1024).toFixed(2)}MB (${reduction}% reduction)`);

        resolve(thumbnailUri);
      } catch (error) {
        reject(new Error(`Failed to generate thumbnail: ${error}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail generation'));
    };

    // Start loading the image
    img.src = dataUri;
  });
}

/**
 * Get the dimensions of an image from its data URI
 *
 * @param dataUri - Image data URI
 * @returns Promise resolving to {width, height}
 *
 * @example
 * const { width, height } = await getImageDimensions(imageUri);
 */
export async function getImageDimensions(
  dataUri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUri;
  });
}

/**
 * Estimate the file size of a base64 data URI in bytes
 *
 * @param dataUri - Image data URI
 * @returns Estimated size in bytes
 *
 * @example
 * const sizeInMB = estimateDataUriSize(imageUri) / (1024 * 1024);
 */
export function estimateDataUriSize(dataUri: string): number {
  // Remove the data URI header (e.g., "data:image/png;base64,")
  const base64String = dataUri.split(',')[1] || dataUri;

  // Base64 encoding increases size by ~33% (4 characters for every 3 bytes)
  // So the actual size is approximately (length * 3) / 4
  const estimatedSize = Math.floor((base64String.length * 3) / 4);

  return estimatedSize;
}

/**
 * Save thumbnail to disk (Electron) or return base64 (web)
 *
 * @param sessionId - Current session ID
 * @param imageId - Image ID
 * @param thumbnailUri - Thumbnail data URI
 * @returns Object with thumbnailUri and thumbnailPath (Electron only)
 */
export function saveThumbnail(
  sessionId: string,
  imageId: string,
  thumbnailUri: string
): { thumbnailUri: string; thumbnailPath?: string } {
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && (window as any).electron;

  if (isElectron && (window as any).electron.saveThumbnailSync) {
    try {
      const result = (window as any).electron.saveThumbnailSync(sessionId, imageId, thumbnailUri);
      if (result.success) {
        console.log(`[Thumbnail] Saved to disk: ${result.path}`);
        // Return both URI (for immediate use) and path (for session storage)
        return {
          thumbnailUri,
          thumbnailPath: result.path
        };
      } else {
        console.error('Failed to save thumbnail to disk:', result.error);
        // Fallback: keep thumbnail in memory
        return { thumbnailUri };
      }
    } catch (error) {
      console.error('Error saving thumbnail:', error);
      return { thumbnailUri };
    }
  } else {
    // Web: return URI only (no disk storage)
    return { thumbnailUri };
  }
}

/**
 * Load thumbnail from disk (Electron) or return existing URI (web)
 *
 * @param thumbnailPath - Path to thumbnail file (Electron only)
 * @returns Thumbnail data URI or null
 */
export function loadThumbnail(thumbnailPath?: string): string | null {
  if (!thumbnailPath) return null;

  // If the stored value is already a data URI (legacy sessions), only trust it
  // when it includes the base64 header. Otherwise this is likely raw base64 and
  // should fall back to disk to avoid invalid data:image URLs.
  const hasDataUriPrefix = thumbnailPath.startsWith('data:image/');
  const hasBase64Header = thumbnailPath.includes(';base64,');
  if (hasDataUriPrefix && hasBase64Header) {
    return thumbnailPath;
  }

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && (window as any).electron;

  if (isElectron && (window as any).electron.loadThumbnailSync) {
    try {
      const thumbnailUri = (window as any).electron.loadThumbnailSync(thumbnailPath);
      if (thumbnailUri) {
        console.log(`[Thumbnail] Loaded from disk: ${thumbnailPath}`);
        return thumbnailUri;
      }
    } catch (error) {
      console.error('Error loading thumbnail:', error);
    }
  }

  return null;
}
