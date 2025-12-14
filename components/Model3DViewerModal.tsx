import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, AxesHelper } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, CameraOff, CameraRotate, X } from 'lucide-react';
import { loadModel } from '../utils/model3DLoaders';
import { CanvasImage } from '../types';

type Model3DViewerModalProps = {
  model: CanvasImage;
  onClose: () => void;
  onScreenshot: (image: {
    dataUri: string;
    thumbnailUri: string;
    width: number;
    height: number;
  }) => void;
};

type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';

const ModelContent: React.FC<{ scene: THREE.Group | null; showGrid: boolean; showAxes: boolean; modelColor?: string; useOriginal: boolean; background: string; }>
= ({ scene, showGrid, showAxes, modelColor, useOriginal, background }) => {
  const [appliedMaterial, setAppliedMaterial] = useState<THREE.Material | null>(null);

  useEffect(() => {
    if (!scene || !modelColor) return undefined;
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(modelColor), roughness: 0.7, metalness: 0.3 });
    const originals: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] | null }> = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originals.push({ mesh: child, material: child.material });
        child.material = material;
      }
    });
    setAppliedMaterial(material);

    return () => {
      originals.forEach(({ mesh, material }) => {
        mesh.material = material ?? mesh.material;
      });
      material.dispose();
      setAppliedMaterial(null);
    };
  }, [scene, modelColor]);

  useEffect(() => {
    if (!scene || useOriginal || !appliedMaterial) return;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = appliedMaterial;
      }
    });
  }, [scene, useOriginal, appliedMaterial]);

  return (
    <group>
      <color attach="background" args={[background]} />
      <ambientLight intensity={1} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      {showGrid && <Grid args={[10, 10]} position={[0, -0.001, 0]} />}
      {showAxes && <primitive object={new AxesHelper(1.5)} />}
      {scene && <primitive object={scene} />}
    </group>
  );
};

const CameraController: React.FC<{ preset: ViewPreset | null; scene: THREE.Group | null; controlsRef: React.RefObject<any> }>
= ({ preset, scene, controlsRef }) => {
  const { camera } = useThree();
  const presetRef = useRef<ViewPreset | null>(null);

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5;
    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.lookAt(center);
    if (controlsRef.current?.target) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [scene, camera, controlsRef]);

  useFrame(() => {
    if (!preset || preset === presetRef.current || !scene) return;

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5;

    const positions: Record<ViewPreset, THREE.Vector3> = {
      front: new THREE.Vector3(center.x, center.y, center.z + distance),
      back: new THREE.Vector3(center.x, center.y, center.z - distance),
      left: new THREE.Vector3(center.x - distance, center.y, center.z),
      right: new THREE.Vector3(center.x + distance, center.y, center.z),
      top: new THREE.Vector3(center.x, center.y + distance, center.z),
      bottom: new THREE.Vector3(center.x, center.y - distance, center.z),
      isometric: new THREE.Vector3(center.x + distance, center.y + distance, center.z + distance)
    };

    const targetPos = positions[preset];
    camera.position.copy(targetPos);
    camera.lookAt(center);
    if (controlsRef.current?.target) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
    presetRef.current = preset;
  });

  return null;
};

export const Model3DViewerModal: React.FC<Model3DViewerModalProps> = ({ model, onClose, onScreenshot }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [background, setBackground] = useState('#1a1a2e');
  const [modelColor, setModelColor] = useState<string | undefined>(model.modelColor || undefined);
  const [useOriginalColors, setUseOriginalColors] = useState(model.useOriginalColors ?? true);
  const [preset, setPreset] = useState<ViewPreset | null>(null);
  const [screenshotResolution, setScreenshotResolution] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!model.modelDataUri) return;
      try {
        const { scene } = await loadModel(model.modelDataUri, undefined);
        if (!cancelled) setLoadedScene(scene);
      } catch (err) {
        console.error('Failed to load model for viewer', err);
      }
    };
    load();
    return () => {
      cancelled = true;
      setLoadedScene(null);
    };
  }, [model.modelDataUri, model.modelFileName]);

  const takeScreenshot = useCallback(() => {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas || !loadedScene) return;

    const width = canvas.width * screenshotResolution;
    const height = canvas.height * screenshotResolution;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(width, height);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const directional = new THREE.DirectionalLight(0xffffff, 1.1);
    directional.position.set(2, 2, 2);
    scene.add(ambient);
    scene.add(directional);

    const cloned = loadedScene.clone(true);
    scene.add(cloned);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5;
    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const dataUri = renderer.domElement.toDataURL('image/png');
    const thumbnailUri = renderer.domElement.toDataURL('image/png');
    renderer.dispose();

    onScreenshot({ dataUri, thumbnailUri, width, height });
  }, [background, loadedScene, onScreenshot, screenshotResolution]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl w-[1100px] h-[760px] flex flex-col border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-zinc-500">3D Model Viewer</p>
            <p className="text-lg font-semibold">{model.modelFileName || 'Untitled model'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1">
          <div className="flex-1" ref={containerRef}>
            <Canvas shadows camera={{ position: [3, 3, 3], fov: 45 }}>
              <PerspectiveCamera makeDefault position={[3, 3, 3]} />
              <OrbitControls ref={controlsRef} enablePan enableRotate enableZoom />
              <ModelContent
                scene={loadedScene}
                showGrid={showGrid}
                showAxes={showAxes}
                background={background}
                modelColor={useOriginalColors ? undefined : modelColor}
                useOriginal={useOriginalColors}
              />
              <CameraController preset={preset} scene={loadedScene} controlsRef={controlsRef} />
            </Canvas>
          </div>

          <div className="w-72 border-l border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-2">VIEW PRESETS</p>
              <div className="grid grid-cols-2 gap-2">
                {(['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric'] as ViewPreset[]).map(presetName => (
                  <button
                    key={presetName}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm capitalize"
                    onClick={() => setPreset(presetName)}
                  >
                    {presetName}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400">DISPLAY</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                Grid
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.target.checked)} />
                Axes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useOriginalColors} onChange={(e) => setUseOriginalColors(e.target.checked)} />
                Use Original Colors
              </label>
              {!useOriginalColors && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-16">Model</span>
                  <input type="color" value={modelColor || '#808080'} onChange={(e) => setModelColor(e.target.value)} className="flex-1 h-8 bg-zinc-800 border border-zinc-700 rounded" />
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="w-16">Background</span>
                <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="flex-1 h-8 bg-zinc-800 border border-zinc-700 rounded" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400">SCREENSHOT</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-20">Resolution</span>
                <select
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  value={screenshotResolution}
                  onChange={(e) => setScreenshotResolution(Number(e.target.value))}
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
              <button
                onClick={takeScreenshot}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-lg py-2"
              >
                <Camera size={16} /> Take Screenshot
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <CameraRotate size={16} /> Orbit with mouse, pan with Shift + drag, zoom with scroll.
          </div>
          <div className="flex items-center gap-3">
            <CameraOff size={16} /> Screenshots hide helpers automatically.
          </div>
        </div>
      </div>
    </div>
  );
};
