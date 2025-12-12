/**
 * 3D Model Loader Utilities
 *
 * Handles loading and processing of GLB, GLTF, OBJ, and IFC files
 * using Three.js loaders.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import type { Model3DType } from '../types';

/**
 * Model loading result with metadata
 */
export interface ModelLoadResult {
  scene: THREE.Group;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  vertexCount: number;
  faceCount: number;
}

/**
 * Detect model type from file extension
 */
export function detectModelType(fileName: string): Model3DType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'glb':
      return 'glb';
    case 'gltf':
      return 'gltf';
    case 'obj':
      return 'obj';
    case 'ifc':
      return 'ifc';
    default:
      return null;
  }
}

/**
 * Get MIME type for 3D model
 */
export function getModelMimeType(modelType: Model3DType): string {
  switch (modelType) {
    case 'glb':
      return 'model/gltf-binary';
    case 'gltf':
      return 'model/gltf+json';
    case 'obj':
      return 'model/obj';
    case 'ifc':
      return 'application/x-step';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Calculate model statistics (vertex count, face count, bounding box)
 */
export function calculateModelStats(scene: THREE.Group): Omit<ModelLoadResult, 'scene'> {
  let vertexCount = 0;
  let faceCount = 0;

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry;
      if (geometry.attributes.position) {
        vertexCount += geometry.attributes.position.count;
      }
      if (geometry.index) {
        faceCount += geometry.index.count / 3;
      } else if (geometry.attributes.position) {
        faceCount += geometry.attributes.position.count / 3;
      }
    }
  });

  // Calculate bounding box
  const boundingBox = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  boundingBox.getCenter(center);
  boundingBox.getSize(size);

  return {
    boundingBox: {
      min: { x: boundingBox.min.x, y: boundingBox.min.y, z: boundingBox.min.z },
      max: { x: boundingBox.max.x, y: boundingBox.max.y, z: boundingBox.max.z },
    },
    center: { x: center.x, y: center.y, z: center.z },
    size: { x: size.x, y: size.y, z: size.z },
    vertexCount,
    faceCount,
  };
}

/**
 * Initialize DRACO loader for compressed GLB files
 */
let dracoLoader: DRACOLoader | null = null;

function getDracoLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    // Use CDN for Draco decoder
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
  }
  return dracoLoader;
}

/**
 * Load GLB/GLTF file
 */
export async function loadGLTF(file: File): Promise<ModelLoadResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getDracoLoader());

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const gltf = await loader.parseAsync(arrayBuffer, '');
        const scene = gltf.scene;

        // Ensure proper material setup
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              (child.material as THREE.Material).side = THREE.DoubleSide;
            }
          }
        });

        const stats = calculateModelStats(scene);
        resolve({ scene, ...stats });
      } catch (error) {
        reject(new Error(`Failed to parse GLTF: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Load GLB/GLTF from data URI
 */
export async function loadGLTFFromDataUri(dataUri: string): Promise<ModelLoadResult> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getDracoLoader());

    // Convert data URI to ArrayBuffer
    const base64 = dataUri.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    loader.parseAsync(arrayBuffer, '')
      .then((gltf) => {
        const scene = gltf.scene;
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            (child.material as THREE.Material).side = THREE.DoubleSide;
          }
        });
        const stats = calculateModelStats(scene);
        resolve({ scene, ...stats });
      })
      .catch((error) => reject(new Error(`Failed to parse GLTF: ${error}`)));
  });
}

/**
 * Load OBJ file
 */
export async function loadOBJ(file: File, mtlFile?: File): Promise<ModelLoadResult> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();

    const loadObjContent = async (materials?: MTLLoader.MaterialCreator) => {
      if (materials) {
        materials.preload();
        loader.setMaterials(materials);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const scene = loader.parse(text);

          // Apply default material if none exists
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (!child.material || (child.material as THREE.Material).type === 'MeshBasicMaterial') {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0x808080,
                  side: THREE.DoubleSide,
                });
              }
            }
          });

          const stats = calculateModelStats(scene);
          resolve({ scene, ...stats });
        } catch (error) {
          reject(new Error(`Failed to parse OBJ: ${error}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read OBJ file'));
      reader.readAsText(file);
    };

    if (mtlFile) {
      const mtlLoader = new MTLLoader();
      const mtlReader = new FileReader();
      mtlReader.onload = (event) => {
        try {
          const mtlText = event.target?.result as string;
          const materials = mtlLoader.parse(mtlText, '');
          loadObjContent(materials);
        } catch (error) {
          // Continue without materials if MTL parsing fails
          console.warn('Failed to parse MTL, continuing without materials:', error);
          loadObjContent();
        }
      };
      mtlReader.onerror = () => loadObjContent(); // Continue without materials
      mtlReader.readAsText(mtlFile);
    } else {
      loadObjContent();
    }
  });
}

/**
 * Load OBJ from data URI
 */
export async function loadOBJFromDataUri(dataUri: string): Promise<ModelLoadResult> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();

    // Convert data URI to text
    const base64 = dataUri.split(',')[1];
    const text = atob(base64);

    try {
      const scene = loader.parse(text);

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.material || (child.material as THREE.Material).type === 'MeshBasicMaterial') {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x808080,
              side: THREE.DoubleSide,
            });
          }
        }
      });

      const stats = calculateModelStats(scene);
      resolve({ scene, ...stats });
    } catch (error) {
      reject(new Error(`Failed to parse OBJ: ${error}`));
    }
  });
}

/**
 * Load IFC file (stub - requires web-ifc library)
 * IFC support is more complex and requires additional WASM setup
 */
export async function loadIFC(file: File): Promise<ModelLoadResult> {
  // IFC loading requires web-ifc library which needs WASM files
  // For now, return a placeholder that can be enhanced later
  return new Promise((resolve, reject) => {
    reject(new Error('IFC support requires additional setup. Please use GLB or OBJ format for now.'));
  });
}

/**
 * Load any supported 3D model file
 */
export async function loadModel(file: File, mtlFile?: File): Promise<ModelLoadResult> {
  const modelType = detectModelType(file.name);

  if (!modelType) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  switch (modelType) {
    case 'glb':
    case 'gltf':
      return loadGLTF(file);
    case 'obj':
      return loadOBJ(file, mtlFile);
    case 'ifc':
      return loadIFC(file);
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }
}

/**
 * Load model from data URI
 */
export async function loadModelFromDataUri(dataUri: string, modelType: Model3DType): Promise<ModelLoadResult> {
  switch (modelType) {
    case 'glb':
    case 'gltf':
      return loadGLTFFromDataUri(dataUri);
    case 'obj':
      return loadOBJFromDataUri(dataUri);
    case 'ifc':
      throw new Error('IFC files cannot be loaded from data URI due to size constraints');
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }
}

/**
 * Generate thumbnail from 3D model
 */
export async function generateModelThumbnail(
  scene: THREE.Group,
  width = 512,
  height = 512,
  backgroundColor: string = '#1a1a1a'
): Promise<string> {
  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.setClearColor(new THREE.Color(backgroundColor), 1);

  // Create scene with lighting
  const thumbnailScene = new THREE.Scene();
  thumbnailScene.background = new THREE.Color(backgroundColor);

  // Clone the model to avoid modifying the original
  const modelClone = scene.clone();
  thumbnailScene.add(modelClone);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  thumbnailScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  thumbnailScene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-5, -5, -5);
  thumbnailScene.add(directionalLight2);

  // Calculate camera position
  const box = new THREE.Box3().setFromObject(modelClone);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = 50;
  const cameraDistance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));

  // Create camera
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, cameraDistance * 10);
  camera.position.set(
    center.x + cameraDistance * 0.7,
    center.y + cameraDistance * 0.5,
    center.z + cameraDistance * 0.7
  );
  camera.lookAt(center);

  // Render
  renderer.render(thumbnailScene, camera);

  // Get data URL
  const dataUri = renderer.domElement.toDataURL('image/png');

  // Cleanup
  renderer.dispose();
  modelClone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });

  return dataUri;
}

/**
 * Convert file to base64 data URI
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Cleanup DRACO loader resources
 */
export function disposeDracoLoader(): void {
  if (dracoLoader) {
    dracoLoader.dispose();
    dracoLoader = null;
  }
}
