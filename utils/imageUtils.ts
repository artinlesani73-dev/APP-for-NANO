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
