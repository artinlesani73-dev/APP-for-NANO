import { Canvas3DModel } from '../types';

const DEFAULT_THUMBNAIL_SIZE = 512;

const getModelType = (fileName: string): Canvas3DModel['modelType'] => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.ifc')) return 'ifc';
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return 'glb';
  return 'obj';
};

const getAspectRatio = (width: number, height: number) => {
  if (height === 0) return 1;
  return Number((width / height).toFixed(4));
};

const readFileAsDataUri = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export interface LoadedModelResult {
  model: Canvas3DModel;
  // Placeholder for future metadata additions (vertex counts, bounding boxes, etc.)
}

/**
 * Base loader for 3D model uploads.
 *
 * This currently reads the file into a data URI for in-memory display and sets up
 * a Canvas3DModel record. Three.js-powered parsing and thumbnail generation will
 * be layered on top in subsequent steps.
 */
export const load3DModelFile = async (file: File): Promise<LoadedModelResult> => {
  const modelType = getModelType(file.name);
  const fileSize = file.size;

  // TODO: Replace placeholder aspect ratio once real thumbnails are generated.
  const placeholderWidth = DEFAULT_THUMBNAIL_SIZE;
  const placeholderHeight = DEFAULT_THUMBNAIL_SIZE;

  const modelDataUri = await readFileAsDataUri(file);

  const model: Canvas3DModel = {
    id: crypto.randomUUID(),
    type: '3d-model',
    modelType,
    modelDataUri,
    fileName: file.name,
    fileSize,
    thumbnailUri: undefined,
    x: 100,
    y: 100,
    width: placeholderWidth,
    height: placeholderHeight,
    originalWidth: placeholderWidth,
    originalHeight: placeholderHeight,
    aspectRatio: getAspectRatio(placeholderWidth, placeholderHeight),
    selected: false,
    useOriginalColors: true
  };

  return { model };
};

export const isSupported3DModelFile = (file: File) =>
  ['.ifc', '.glb', '.gltf', '.obj'].some((ext) => file.name.toLowerCase().endsWith(ext));

