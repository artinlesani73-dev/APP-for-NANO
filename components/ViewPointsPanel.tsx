import React, { useState, useRef } from 'react';
import { Session, StoredImageMeta, GenerationConfig } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/newStorageService';
import { Loader2 } from 'lucide-react';

interface ViewPointsPanelProps {
  sessions: Session[];
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  currentUser: { displayName: string; id: string } | null;
  currentSessionId: string | null;
  onViewGenerated: (generationId: string, outputs: StoredImageMeta[], texts: string[]) => void;
}

export const ViewPointsPanel: React.FC<ViewPointsPanelProps> = ({
  sessions,
  theme,
  loadImage,
  config,
  setConfig,
  currentUser,
  currentSessionId,
  onViewGenerated
}) => {
  const [horizontalAngle, setHorizontalAngle] = useState(39);
  const [verticalAngle, setVerticalAngle] = useState(38);
  const [zoomLevel, setZoomLevel] = useState(51);
  const [fov, setFov] = useState(45); // Field of view
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMeta, setSelectedImageMeta] = useState<{ session_id: string; generation_id: string; image: StoredImageMeta } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Build structured viewpoint prompt
  const buildViewpointPrompt = () => {
    // Determine direction based on horizontal angle
    let direction = 'centered';
    if (horizontalAngle > 20) direction = `rotated ${horizontalAngle}° to the right`;
    else if (horizontalAngle < -20) direction = `rotated ${Math.abs(horizontalAngle)}° to the left`;

    // Determine height based on vertical angle
    let height = 'at eye level';
    if (verticalAngle > 20) height = `${verticalAngle}° above (high angle)`;
    else if (verticalAngle < -20) height = `${Math.abs(verticalAngle)}° below (low angle)`;

    // Determine zoom/distance
    let distance = 'at normal distance';
    if (zoomLevel > 20) distance = `${zoomLevel}% closer (zoomed in)`;
    else if (zoomLevel < -20) distance = `${Math.abs(zoomLevel)}% farther (zoomed out)`;

    // Determine lens/FOV
    let lens = '';
    if (fov < 35) lens = ' using a narrow/telephoto lens';
    else if (fov > 60) lens = ' using a wide-angle lens';
    else lens = ' using a standard lens';

    // Build the structured prompt
    const prompt = `Generate the exact same scene from the control image, but viewed from a different camera angle.

Camera Parameters for New View:
- Horizontal Rotation: ${direction}
- Vertical Angle: ${height}
- Camera Distance: ${distance}
- Field of View: ${fov}°${lens}

Requirements:
- Keep EXACTLY the same scene, objects, layout, and composition from the control image
- Only change the camera position and angle as specified
- Preserve all lighting, colors, textures, and details
- Maintain photorealistic quality
- Ensure natural perspective and framing

Technical Specifications:
- Horizontal: ${horizontalAngle}°
- Vertical: ${verticalAngle}°
- Zoom: ${zoomLevel > 0 ? '+' : ''}${zoomLevel}%
- FOV: ${fov}°`;

    return prompt;
  };

  const handleGenerateView = async () => {
    if (!selectedImageMeta) {
      alert('Please select an image first');
      return;
    }

    if (!currentSessionId) {
      alert('No active session. Please create or select a session first.');
      return;
    }

    setIsGenerating(true);

    try {
      // Get the original image data
      const imageData = loadImage('output', selectedImageMeta.generation_id, selectedImageMeta.image.filename);
      if (!imageData) {
        throw new Error('Failed to load image data');
      }

      // Build the viewpoint prompt
      const prompt = buildViewpointPrompt();

      console.log('Generating viewpoint with prompt:', prompt);
      console.log('Camera settings:', {
        horizontal: horizontalAngle,
        vertical: verticalAngle,
        zoom: zoomLevel,
        fov: fov,
        model: config.model
      });

      // Generate new view using the image as control (to preserve structure/composition)
      const result = await GeminiService.generateImage(
        prompt,
        config,
        imageData, // use selected image as control to preserve scene structure
        undefined, // no reference images
        currentUser?.username
      );

      console.log('Generation result:', result);

      // Create a new generation ID
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store the generated images
      const storedImages: StoredImageMeta[] = [];
      for (let i = 0; i < result.images.length; i++) {
        const imageBase64 = result.images[i];

        // StorageService.saveImage returns StoredImageMeta with id, filename, hash, etc.
        const storedImage = StorageService.saveImage(
          `data:image/png;base64,${imageBase64}`,
          'output'
        );

        storedImages.push(storedImage);
      }

      // Save generation to session
      const currentSession = sessions.find(s => s.session_id === currentSessionId);
      if (currentSession) {
        const newGeneration = {
          generation_id: generationId,
          timestamp: new Date().toISOString(),
          status: 'completed' as const,
          prompt: prompt,
          parameters: config,
          control_images: [selectedImageMeta.image], // Using as control to preserve scene structure
          output_images: storedImages,
          output_texts: result.texts,
          viewpoint_data: {
            horizontal_angle: horizontalAngle,
            vertical_angle: verticalAngle,
            zoom_level: zoomLevel,
            field_of_view: fov,
            source_image: selectedImageMeta.image.filename,
            source_generation: selectedImageMeta.generation_id
          }
        };

        await StorageService.saveSession({
          ...currentSession,
          generations: [...currentSession.generations, newGeneration]
        });

        // Notify parent component
        onViewGenerated(generationId, storedImages, result.texts);

        alert(`View generated successfully!\n\nGeneration ID: ${generationId}\nImages: ${storedImages.length}\nCamera: H${horizontalAngle}° V${verticalAngle}° Z${zoomLevel}% FOV${fov}°`);
      }

    } catch (error: any) {
      console.error('Error generating view:', error);
      alert(`Error generating view: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
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
            {/* Model Selection */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Generation Model
              </h3>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Free/Fast)</option>
                <option value="gemini-3-pro-image-preview">Gemini 3.0 Pro Image (Paid/Quality)</option>
              </select>
            </div>

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
                      // Apply scale here to maintain cube proportions
                      // Calculate scale: 0% zoom = 1.0 scale, +100% = 2.0 scale, -100% = 0.5 scale
                      transform: `scale(${1 + zoomLevel / 200})`,
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    {/* Cube container */}
                    <div
                      className="absolute inset-0"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${-verticalAngle}deg) rotateY(${horizontalAngle}deg)`,
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
              disabled={!selectedImage || isGenerating}
              className={`w-full py-4 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                selectedImage && !isGenerating
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating View...
                </>
              ) : (
                'Generate View'
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setHorizontalAngle(39);
                setVerticalAngle(38);
                setZoomLevel(51);
                setFov(45);
              }}
              disabled={isGenerating}
              className="w-full py-2 rounded-lg font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
