import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import {
  X,
  Camera,
  RotateCcw,
  Maximize2,
  Grid3X3,
  Box,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Canvas3DModel, CanvasImage } from '../types';
import { loadModelFromDataUri, type ModelLoadResult } from '../utils/model3DLoaders';

interface Model3DViewerModalProps {
  model: Canvas3DModel;
  isOpen: boolean;
  onClose: () => void;
  onScreenshot: (image: Omit<CanvasImage, 'x' | 'y'>) => void;
}

// Scene content component that has access to Three.js context
const SceneContent: React.FC<{
  modelResult: ModelLoadResult | null;
  showGrid: boolean;
  showWireframe: boolean;
  showAxes: boolean;
  backgroundColor: string;
  controlsRef: React.RefObject<any>;
}> = ({
  modelResult,
  showGrid,
  showWireframe,
  showAxes,
  backgroundColor,
  controlsRef,
}) => {
  const { scene, camera } = useThree();
  const modelRef = useRef<THREE.Group>(null);

  // Update scene background
  useEffect(() => {
    scene.background = new THREE.Color(backgroundColor);
  }, [scene, backgroundColor]);

  // Apply wireframe mode
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            if ('wireframe' in mat) {
              mat.wireframe = showWireframe;
            }
          });
        }
      });
    }
  }, [showWireframe]);

  // Fit camera to model on load
  useEffect(() => {
    if (modelResult && controlsRef.current) {
      const box = new THREE.Box3().setFromObject(modelResult.scene);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera as THREE.PerspectiveCamera).fov;
      const cameraDistance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.5;

      camera.position.set(
        center.x + cameraDistance * 0.7,
        center.y + cameraDistance * 0.5,
        center.z + cameraDistance * 0.7
      );
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [modelResult, camera, controlsRef]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      <hemisphereLight intensity={0.3} />

      {/* Model */}
      {modelResult && (
        <primitive
          ref={modelRef}
          object={modelResult.scene}
          dispose={null}
        />
      )}

      {/* Grid */}
      {showGrid && (
        <Grid
          args={[20, 20]}
          position={[0, modelResult?.boundingBox?.min.y || 0, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6e6e6e"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
        />
      )}

      {/* Axes Helper */}
      {showAxes && <axesHelper args={[5]} />}

      {/* Orbit Controls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
      />

      {/* Gizmo Helper */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport labelColor="white" axisHeadScale={1} />
      </GizmoHelper>
    </>
  );
};

export const Model3DViewerModal: React.FC<Model3DViewerModalProps> = ({
  model,
  isOpen,
  onClose,
  onScreenshot,
}) => {
  const controlsRef = useRef<any>(null);
  const [modelResult, setModelResult] = useState<ModelLoadResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Display options
  const [showGrid, setShowGrid] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showAxes, setShowAxes] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [showInfo, setShowInfo] = useState(false);

  // Screenshot options
  const [screenshotScale, setScreenshotScale] = useState<1 | 2 | 4>(2);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  // Load model
  useEffect(() => {
    if (!isOpen || !model.modelDataUri) return;

    setIsLoading(true);
    setError(null);

    loadModelFromDataUri(model.modelDataUri, model.modelType)
      .then((result) => {
        setModelResult(result);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      });

    return () => {
      // Cleanup model on unmount
      if (modelResult) {
        modelResult.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
    };
  }, [isOpen, model.modelDataUri, model.modelType]);

  // View presets
  const applyViewPreset = useCallback((preset: string) => {
    if (!controlsRef.current || !modelResult) return;

    const box = new THREE.Box3().setFromObject(modelResult.scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    let position: THREE.Vector3;
    switch (preset) {
      case 'front':
        position = new THREE.Vector3(center.x, center.y, center.z + distance);
        break;
      case 'back':
        position = new THREE.Vector3(center.x, center.y, center.z - distance);
        break;
      case 'left':
        position = new THREE.Vector3(center.x - distance, center.y, center.z);
        break;
      case 'right':
        position = new THREE.Vector3(center.x + distance, center.y, center.z);
        break;
      case 'top':
        position = new THREE.Vector3(center.x, center.y + distance, center.z);
        break;
      case 'bottom':
        position = new THREE.Vector3(center.x, center.y - distance, center.z);
        break;
      case 'iso':
      default:
        position = new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7
        );
        break;
    }

    controlsRef.current.object.position.copy(position);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, [modelResult]);

  // Reset view
  const resetView = useCallback(() => {
    applyViewPreset('iso');
  }, [applyViewPreset]);

  // Fit to screen
  const fitToScreen = useCallback(() => {
    if (!controlsRef.current || !modelResult) return;

    const box = new THREE.Box3().setFromObject(modelResult.scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const camera = controlsRef.current.object as THREE.PerspectiveCamera;
    const fov = camera.fov;
    const cameraDistance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.5;

    const direction = new THREE.Vector3();
    direction.subVectors(camera.position, center).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, [modelResult]);

  // Take screenshot
  const takeScreenshot = useCallback(async () => {
    const canvas = document.querySelector('#model-viewer-canvas canvas') as HTMLCanvasElement;
    if (!canvas) return;

    setIsTakingScreenshot(true);

    try {
      // Get current canvas dimensions
      const width = canvas.width * screenshotScale;
      const height = canvas.height * screenshotScale;

      // Create high-res canvas
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const ctx = offscreenCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Draw the WebGL canvas to the offscreen canvas
      ctx.drawImage(canvas, 0, 0, width, height);

      // Get data URL
      const dataUri = offscreenCanvas.toDataURL('image/png');

      // Generate thumbnail
      const thumbnailCanvas = document.createElement('canvas');
      const thumbSize = 512;
      thumbnailCanvas.width = thumbSize;
      thumbnailCanvas.height = thumbSize;
      const thumbCtx = thumbnailCanvas.getContext('2d');

      if (thumbCtx) {
        // Calculate aspect-fit dimensions
        const aspectRatio = width / height;
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

        thumbCtx.fillStyle = backgroundColor;
        thumbCtx.fillRect(0, 0, thumbSize, thumbSize);
        thumbCtx.drawImage(offscreenCanvas, offsetX, offsetY, drawWidth, drawHeight);
      }

      const thumbnailUri = thumbnailCanvas.toDataURL('image/jpeg', 0.85);

      // Create canvas image object
      const screenshotImage: Omit<CanvasImage, 'x' | 'y'> = {
        id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        dataUri,
        thumbnailUri,
        width: Math.min(width, 512),
        height: Math.min(height, 512),
        originalWidth: width,
        originalHeight: height,
        selected: false,
      };

      onScreenshot(screenshotImage);
    } catch (err) {
      console.error('Failed to take screenshot:', err);
    } finally {
      setIsTakingScreenshot(false);
    }
  }, [screenshotScale, backgroundColor, onScreenshot]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-6xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <Box size={20} className="text-blue-400" />
            <span className="font-medium text-zinc-200">{model.fileName}</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              {model.modelType.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D Viewport */}
          <div className="flex-1 relative" id="model-viewer-canvas">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="flex flex-col items-center gap-3 text-zinc-400">
                  <Loader2 size={32} className="animate-spin" />
                  <span className="text-sm">Loading model...</span>
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="flex flex-col items-center gap-3 text-red-400 max-w-md text-center">
                  <X size={32} />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            ) : (
              <Canvas
                camera={{ fov: 50, near: 0.1, far: 1000 }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
                style={{ background: backgroundColor }}
              >
                <Suspense fallback={null}>
                  <SceneContent
                    modelResult={modelResult}
                    showGrid={showGrid}
                    showWireframe={showWireframe}
                    showAxes={showAxes}
                    backgroundColor={backgroundColor}
                    controlsRef={controlsRef}
                  />
                </Suspense>
              </Canvas>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-64 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* View Presets */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  View Presets
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {['front', 'back', 'left', 'right', 'top', 'bottom'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyViewPreset(preset)}
                      className="px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 capitalize transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => applyViewPreset('iso')}
                  className="w-full mt-2 px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                >
                  Isometric
                </button>
              </div>

              {/* Display Options */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Display
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                    />
                    <Grid3X3 size={14} />
                    <span>Grid</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWireframe}
                      onChange={(e) => setShowWireframe(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                    />
                    <Box size={14} />
                    <span>Wireframe</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAxes}
                      onChange={(e) => setShowAxes(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span>Axes</span>
                  </label>
                </div>
              </div>

              {/* Background Color */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Background
                </h3>
                <div className="flex gap-2">
                  {['#1a1a1a', '#2d2d2d', '#404040', '#ffffff', '#0a0a0a'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setBackgroundColor(color)}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        backgroundColor === color
                          ? 'border-blue-500 scale-110'
                          : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-xs text-zinc-500">{backgroundColor}</span>
                </div>
              </div>

              {/* Screenshot Options */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Screenshot
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Resolution</label>
                    <div className="flex gap-1">
                      {([1, 2, 4] as const).map((scale) => (
                        <button
                          key={scale}
                          onClick={() => setScreenshotScale(scale)}
                          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                            screenshotScale === scale
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {scale}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                >
                  <span className="flex items-center gap-2">
                    <Info size={14} />
                    Model Info
                  </span>
                  {showInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showInfo && modelResult && (
                  <div className="mt-3 space-y-2 text-xs text-zinc-400">
                    <div className="flex justify-between">
                      <span>Vertices:</span>
                      <span className="text-zinc-300">{modelResult.vertexCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Faces:</span>
                      <span className="text-zinc-300">{modelResult.faceCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-zinc-300">
                        {(model.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    {modelResult.size && (
                      <div className="flex justify-between">
                        <span>Dimensions:</span>
                        <span className="text-zinc-300">
                          {modelResult.size.x.toFixed(1)} x {modelResult.size.y.toFixed(1)} x{' '}
                          {modelResult.size.z.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={resetView}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
            >
              <RotateCcw size={14} />
              Reset View
            </button>
            <button
              onClick={fitToScreen}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
            >
              <Maximize2 size={14} />
              Fit to Screen
            </button>
          </div>
          <button
            onClick={takeScreenshot}
            disabled={isLoading || !!error || isTakingScreenshot}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-white font-medium transition-colors"
          >
            {isTakingScreenshot ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <Camera size={16} />
                Take Screenshot
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Model3DViewerModal;
