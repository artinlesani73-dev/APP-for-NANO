import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { IFCLoader } from 'three/examples/jsm/loaders/IFCLoader.js';

const createUrlFromDataUri = (dataUri: string): string => {
  const binary = atob(dataUri.split(',')[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([array]);
  return URL.createObjectURL(blob);
};

export const loadGLTF = async (fileOrDataUri: File | string): Promise<THREE.Group> => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);

  if (fileOrDataUri instanceof File) {
    const arrayBuffer = await fileOrDataUri.arrayBuffer();
    const gltf = await loader.parseAsync(arrayBuffer, '');
    return gltf.scene;
  }

  const url = createUrlFromDataUri(fileOrDataUri);
  const gltf = await loader.loadAsync(url);
  URL.revokeObjectURL(url);
  return gltf.scene;
};

export const loadOBJ = async (fileOrDataUri: File | string, mtlFile?: File | string): Promise<THREE.Group> => {
  const loader = new OBJLoader();

  if (mtlFile) {
    const mtlLoader = new MTLLoader();
    const materials = typeof mtlFile === 'string'
      ? await mtlLoader.loadAsync(createUrlFromDataUri(mtlFile))
      : mtlLoader.parse(await mtlFile.text(), '');
    materials.preload();
    loader.setMaterials(materials);
  }

  if (fileOrDataUri instanceof File) {
    const text = await fileOrDataUri.text();
    return loader.parse(text);
  }

  return loader.loadAsync(createUrlFromDataUri(fileOrDataUri));
};

export const loadIFC = async (fileOrDataUri: File | string): Promise<THREE.Group> => {
  const loader = new IFCLoader();
  await loader.ifcManager.setWasmPath('/wasm/');

  const url = fileOrDataUri instanceof File
    ? URL.createObjectURL(fileOrDataUri)
    : createUrlFromDataUri(fileOrDataUri);

  const model = await loader.loadAsync(url);
  URL.revokeObjectURL(url);
  return model;
};

export const loadModel = async (
  fileOrDataUri: File | string,
  mtlFile?: File | string
): Promise<{ scene: THREE.Group; type: 'glb' | 'obj' | 'ifc' }> => {
  const name = typeof fileOrDataUri === 'string' ? 'model.gltf' : fileOrDataUri.name;
  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'glb':
    case 'gltf':
      return { scene: await loadGLTF(fileOrDataUri), type: 'glb' };
    case 'obj':
      return { scene: await loadOBJ(fileOrDataUri, mtlFile), type: 'obj' };
    case 'ifc':
      return { scene: await loadIFC(fileOrDataUri), type: 'ifc' };
    default:
      throw new Error(`Unsupported file format: ${ext || 'unknown'}`);
  }
};

export const generateModelThumbnail = async (
  scene: THREE.Group,
  { width, height }: { width: number; height: number } = { width: 512, height: 512 }
): Promise<string> => {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2;

  camera.position.set(center.x + distance, center.y + distance, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(1, 1, 1);

  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color('#1a1a2e');
  previewScene.add(ambient);
  previewScene.add(directional);
  previewScene.add(scene.clone());

  renderer.render(previewScene, camera);
  const dataUri = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return dataUri;
};
