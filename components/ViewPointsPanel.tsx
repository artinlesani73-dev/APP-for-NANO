import React, { useState, useRef } from 'react';
import { Session, StoredImageMeta } from '../types';

interface ViewPointsPanelProps {
  sessions: Session[];
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
}

export const ViewPointsPanel: React.FC<ViewPointsPanelProps> = ({
  sessions,
  theme,
  loadImage
}) => {
  const [horizontalAngle, setHorizontalAngle] = useState(39);
  const [verticalAngle, setVerticalAngle] = useState(38);
  const [zoomLevel, setZoomLevel] = useState(51);
  const [fov, setFov] = useState(45); // Field of view
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMeta, setSelectedImageMeta] = useState<{ session_id: string; generation_id: string; image: StoredImageMeta } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startH: number; startV: number }>({ x: 0, y: 0, startH: 0, startV: 0 });

  // Get all output images from sessions
  const getAllImages = (): Array<{ session_id: string; generation_id: string; image: StoredImageMeta }> => {
    const images: Array<{ session_id: string; generation_id: string; image: StoredImageMeta }> = [];
    sessions.forEach(session => {
      session.generations.forEach(generation => {
        if (generation.output_images && generation.output_images.length > 0) {
          generation.output_images.forEach(image => {
            images.push({
              session_id: session.session_id,
              generation_id: generation.generation_id,
              image
            });
          });
        }
      });
    });
    return images;
  };

  const allImages = getAllImages();

  const handleImageSelect = (session_id: string, generation_id: string, image: StoredImageMeta) => {
    const imageUrl = loadImage('output', generation_id, image.filename);
    setSelectedImage(imageUrl);
    setSelectedImageMeta({ session_id, generation_id, image });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startH: horizontalAngle,
      startV: verticalAngle
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Sensitivity: 0.5 degrees per pixel
    const newH = Math.max(-90, Math.min(90, dragStartRef.current.startH + deltaX * 0.5));
    const newV = Math.max(-90, Math.min(90, dragStartRef.current.startV - deltaY * 0.5));

    setHorizontalAngle(Math.round(newH));
    setVerticalAngle(Math.round(newV));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleGenerateView = () => {
    if (!selectedImageMeta) {
      alert('Please select an image first');
      return;
    }

    const direction = horizontalAngle > 20 ? 'RIGHT' : horizontalAngle < -20 ? 'LEFT' : 'CENTERED';
    const height = verticalAngle > 20 ? 'HIGH' : verticalAngle < -20 ? 'LOW' : 'EYE LEVEL';
    const zoom = zoomLevel > 20 ? 'CLOSE UP' : zoomLevel < -20 ? 'ZOOM OUT' : 'NORMAL';

    const instruction = `ROTATE ${direction}, ${height}, ${zoom}`;

    console.log('Generating view with settings:', {
      horizontal: `${horizontalAngle}° H`,
      vertical: `${verticalAngle}° V`,
      zoom: `${zoomLevel > 0 ? '+' : ''}${zoomLevel}% Z`,
      fov: `${fov}° FOV`,
      instruction
    });

    alert(`View settings:\n${horizontalAngle}° H, ${verticalAngle}° V, ${zoomLevel > 0 ? '+' : ''}${zoomLevel}% Z\nFOV: ${fov}°\n\nInstruction: ${instruction}`);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          View Points
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Drag the cube to rotate • Adjust camera settings with sliders
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* Left Panel - Image Selection and Preview */}
          <div className="space-y-6">
            {/* Image Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden">
              {selectedImage ? (
                <div className="relative">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setSelectedImageMeta(null);
                      }}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center text-zinc-500 dark:text-zinc-400">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Select an image from below</p>
                  </div>
                </div>
              )}
            </div>

            {/* Image Gallery */}
            <div>
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Select an Image
              </h3>
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {allImages.length === 0 ? (
                  <div className="col-span-3 text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                    No images available. Generate some images first.
                  </div>
                ) : (
                  allImages.map((item, index) => {
                    const imageUrl = loadImage('output', item.generation_id, item.image.filename);
                    const isSelected = selectedImageMeta?.generation_id === item.generation_id &&
                                      selectedImageMeta?.image.filename === item.image.filename;

                    return imageUrl ? (
                      <button
                        key={`${item.generation_id}-${item.image.filename}-${index}`}
                        onClick={() => handleImageSelect(item.session_id, item.generation_id, item.image)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/50'
                            : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-400'
                        }`}
                      >
                        <img
                          src={imageUrl}
                          alt={`Output ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : null;
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Viewpoint Controls */}
          <div className="space-y-6">
            {/* Viewpoint Visualization */}
            <div className="bg-black rounded-lg p-8">
              <div className="text-center mb-6">
                <h3 className="text-zinc-400 text-sm font-medium tracking-wider">
                  SET YOUR VIEWPOINT
                </h3>
                <p className="text-zinc-600 text-xs mt-1">
                  Click and drag to rotate
                </p>
              </div>

              <div className="flex items-center justify-center gap-8 mb-6">
                {/* 3D Cube Visualization */}
                <div
                  className="relative select-none"
                  style={{
                    perspective: '1000px',
                    // Adjust perspective based on zoom for more dramatic effect
                    perspectiveOrigin: '50% 50%'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div
                    className={`w-48 h-48 border-2 border-zinc-700 rounded-lg bg-zinc-900/50 relative ${
                      isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                    style={{
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {/* Cube container */}
                    <div
                      className="absolute inset-0"
                      style={{
                        transformStyle: 'preserve-3d',
                        // Calculate scale: 0% zoom = 1.0 scale, +100% = 2.0 scale, -100% = 0.5 scale
                        transform: `rotateX(${-verticalAngle}deg) rotateY(${horizontalAngle}deg) scale(${1 + zoomLevel / 200})`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease'
                      }}
                    >
                      {/* Front face with image preview */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/30 flex items-center justify-center overflow-hidden"
                        style={{
                          transform: 'translateZ(48px)'
                        }}
                      >
                        {selectedImage ? (
                          <img
                            src={selectedImage}
                            alt="Preview"
                            className="w-full h-full object-cover opacity-60 pointer-events-none"
                          />
                        ) : (
                          <div className="text-zinc-600 text-xs">Front</div>
                        )}
                      </div>

                      {/* Back face */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/50"
                        style={{
                          transform: 'translateZ(-48px) rotateY(180deg)'
                        }}
                      />

                      {/* Left face */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/40"
                        style={{
                          transform: 'rotateY(-90deg) translateZ(48px)'
                        }}
                      />

                      {/* Right face */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/40"
                        style={{
                          transform: 'rotateY(90deg) translateZ(48px)'
                        }}
                      />

                      {/* Top face */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/60"
                        style={{
                          transform: 'rotateX(90deg) translateZ(48px)'
                        }}
                      />

                      {/* Bottom face */}
                      <div
                        className="absolute inset-0 border border-zinc-600 bg-zinc-800/60"
                        style={{
                          transform: 'rotateX(-90deg) translateZ(48px)'
                        }}
                      />
                    </div>

                    {/* Camera indicator */}
                    <div
                      className="absolute w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none"
                      style={{
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) translateZ(${100 + zoomLevel}px)`,
                        transformStyle: 'preserve-3d'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Current Values Display */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-4 text-zinc-300 text-sm font-mono">
                  <span>{horizontalAngle}° H</span>
                  <span>{verticalAngle}° V</span>
                  <span>{zoomLevel > 0 ? '+' : ''}{zoomLevel}% Z</span>
                </div>
              </div>

              {/* Instruction Display */}
              <div className="text-center">
                <div className="text-zinc-500 text-xs uppercase tracking-wider">
                  {horizontalAngle > 20 ? 'ROTATE RIGHT' : horizontalAngle < -20 ? 'ROTATE LEFT' : 'CENTERED'},
                  {' '}
                  {verticalAngle > 20 ? 'HIGH' : verticalAngle < -20 ? 'LOW' : 'EYE LEVEL'},
                  {' '}
                  {zoomLevel > 20 ? 'CLOSE UP' : zoomLevel < -20 ? 'ZOOM OUT' : 'NORMAL'}
                </div>
              </div>
            </div>

            {/* Camera Settings Panel */}
            <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Camera Settings
              </h3>

              {/* Zoom Level Slider */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Zoom Level: {zoomLevel > 0 ? '+' : ''}{zoomLevel}%
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Field of View Slider */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Field of View: {fov}°
                </label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <span>Narrow</span>
                  <span>Wide</span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateView}
              disabled={!selectedImage}
              className={`w-full py-4 rounded-lg font-medium text-white transition-colors ${
                selectedImage
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed'
              }`}
            >
              Generate View
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setHorizontalAngle(39);
                setVerticalAngle(38);
                setZoomLevel(51);
                setFov(45);
              }}
              className="w-full py-2 rounded-lg font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      {/* Custom slider styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};
