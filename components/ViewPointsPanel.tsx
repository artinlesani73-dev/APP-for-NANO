import React, { useState, useRef } from 'react';
import { Session, StoredImageMeta, GenerationConfig } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/newStorageService';
import { Loader2, Upload, X } from 'lucide-react';

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
  const [horizontalAngle, setHorizontalAngle] = useState(0);
  const [verticalAngle, setVerticalAngle] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [fov, setFov] = useState(45);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageMeta, setUploadedImageMeta] = useState<StoredImageMeta | null>(null);
  const [outputImages, setOutputImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; startH: number; startV: number }>({ x: 0, y: 0, startH: 0, startV: 0 });

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);

      // Save the uploaded image
      const savedImage = StorageService.saveImage(result, 'control');
      setUploadedImageMeta(savedImage);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  // Cube rotation handlers
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

    const newH = Math.max(-90, Math.min(90, dragStartRef.current.startH + deltaX * 0.5));
    const newV = Math.max(-90, Math.min(90, dragStartRef.current.startV - deltaY * 0.5));

    setHorizontalAngle(Math.round(newH));
    setVerticalAngle(Math.round(newV));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Natural language translation functions
  const translateHorizontalRotation = (angle: number): string => {
    const absAngle = Math.abs(angle);

    if (absAngle <= 15) return 'Front view';
    if (angle > 0) {
      // Rotating right
      if (angle <= 30) return 'Front view, slight rotation right';
      if (angle <= 60) return 'Rotate right';
      if (angle <= 120) return 'Right side view';
      return 'Rotate far right';
    } else {
      // Rotating left
      if (absAngle <= 30) return 'Front view, slight rotation left';
      if (absAngle <= 60) return 'Rotate left';
      if (absAngle <= 120) return 'Left side view';
      return 'Rotate far left';
    }
  };

  const translateVerticalAngle = (angle: number): string => {
    if (angle <= -70) return 'Plan view';
    if (angle <= -45) return 'High aerial view';
    if (angle <= -30) return 'Aerial view';
    if (angle <= -15) return 'High angle view';
    if (angle <= 15) return 'Eye level / human perspective';
    if (angle <= 30) return 'Low angle view';
    if (angle <= 45) return 'Ground level view';
    if (angle <= 70) return 'Extreme low angle (looking up)';
    return "Worm's eye view (bottom-up)";
  };

  const translateZoomLevel = (zoom: number): string => {
    if (zoom <= -30) return 'Extreme wide shot (very far distance)';
    if (zoom <= -15) return 'Wide shot (far distance)';
    if (zoom <= 15) return 'Medium shot (moderate distance)';
    if (zoom <= 30) return 'Close-up (near distance)';
    return 'Extreme close-up (very near distance)';
  };

  const translateFieldOfView = (fov: number): string => {
    if (fov <= 50) return 'Telephoto lens (narrow field, compressed perspective)';
    if (fov <= 70) return 'Normal lens (natural perspective)';
    if (fov <= 90) return 'Wide angle lens (expanded perspective)';
    return 'Ultra-wide lens (dramatic perspective distortion)';
  };

  // Build viewpoint prompt with natural language descriptions
  const buildViewpointPrompt = () => {
    const horizontalDesc = translateHorizontalRotation(horizontalAngle);
    const verticalDesc = translateVerticalAngle(verticalAngle);
    const zoomDesc = translateZoomLevel(zoomLevel);
    const fovDesc = translateFieldOfView(fov);

    const prompt = `Generate the exact same scene from the control image, but viewed from a different camera angle.

Camera Parameters for New View:
- Horizontal Rotation: ${horizontalDesc}
- Vertical Angle: ${verticalDesc}
- Camera Distance: ${zoomDesc}
- Lens Type: ${fovDesc}

Requirements:
- Keep the same objects, light, material and mood from the control image
- Only change the camera position and angle as specified
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
    if (!uploadedImage || !uploadedImageMeta) {
      alert('Please upload an image first');
      return;
    }

    if (!currentSessionId) {
      alert('No active session. Please create or select a session first.');
      return;
    }

    setIsGenerating(true);
    setOutputImages([]);

    try {
      const prompt = buildViewpointPrompt();

      console.log('Generating viewpoint with prompt:', prompt);
      console.log('Camera settings:', {
        horizontal: horizontalAngle,
        vertical: verticalAngle,
        zoom: zoomLevel,
        fov: fov,
        model: config.model
      });

      // Generate new view using the image as control
      const result = await GeminiService.generateImage(
        prompt,
        config,
        uploadedImage,
        undefined,
        currentUser?.displayName
      );

      console.log('Generation result:', result);

      // Create a new generation ID
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store the generated images
      const storedImages: StoredImageMeta[] = [];
      const outputDataUris: string[] = [];

      for (let i = 0; i < result.images.length; i++) {
        const imageBase64 = result.images[i];
        const dataUri = `data:image/png;base64,${imageBase64}`;

        const storedImage = StorageService.saveImage(dataUri, 'output');
        storedImages.push(storedImage);

        // Load the image for display
        const loadedImage = StorageService.loadImage('output', storedImage.id, storedImage.filename);
        if (loadedImage) {
          outputDataUris.push(loadedImage);
        }
      }

      setOutputImages(outputDataUris);

      // Save generation to session (exactly like Generation View)
      const currentSession = sessions.find(s => s.session_id === currentSessionId);
      if (currentSession) {
        const newGeneration = {
          generation_id: generationId,
          timestamp: new Date().toISOString(),
          status: 'completed' as const,
          prompt: prompt,
          parameters: config,
          control_images: [uploadedImageMeta],
          output_images: storedImages,
          output_texts: result.texts,
          viewpoint_data: {
            horizontal_angle: horizontalAngle,
            vertical_angle: verticalAngle,
            zoom_level: zoomLevel,
            field_of_view: fov,
            source_image: uploadedImageMeta.filename,
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
          Upload an image, set camera angles, and generate new viewpoints
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
          {/* Left Column - Input & Output (8/12) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {/* Upload Area */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Input Image</h3>
              </div>
              <div className="p-4">
                {uploadedImage ? (
                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full h-auto max-h-96 object-contain rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setUploadedImageMeta(null);
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600'
                    }`}
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      Drag and drop an image here, or click to browse
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      Supports PNG, JPG, WebP
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Output Area */}
            {outputImages.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Generated Views</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {outputImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Output ${idx + 1}`}
                          className="w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Controls (4/12) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Model Selection */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                Model
              </h3>
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-blue-500"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option>
                <option value="gemini-3-pro-image-preview">Gemini 3.0 Pro</option>
              </select>
            </div>

            {/* 3D Cube Viewpoint */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                Camera Angle
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Drag to rotate
              </p>

              {/* Cube Visualization */}
              <div className="flex justify-center mb-4">
                <div
                  className="relative select-none"
                  style={{ perspective: '800px' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div
                    className={`w-32 h-32 border-2 border-zinc-700 rounded-lg bg-zinc-900/50 relative ${
                      isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: `scale(${1 + zoomLevel / 200})`,
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${-verticalAngle}deg) rotateY(${horizontalAngle}deg)`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease'
                      }}
                    >
                      {/* Cube faces */}
                      {[
                        { transform: 'translateZ(32px)', bg: 'bg-blue-500/30' },
                        { transform: 'translateZ(-32px) rotateY(180deg)', bg: 'bg-blue-500/20' },
                        { transform: 'rotateY(-90deg) translateZ(32px)', bg: 'bg-blue-500/20' },
                        { transform: 'rotateY(90deg) translateZ(32px)', bg: 'bg-blue-500/20' },
                        { transform: 'rotateX(90deg) translateZ(32px)', bg: 'bg-blue-500/25' },
                        { transform: 'rotateX(-90deg) translateZ(32px)', bg: 'bg-blue-500/25' }
                      ].map((face, i) => (
                        <div
                          key={i}
                          className={`absolute inset-0 border border-zinc-600 ${face.bg}`}
                          style={{ transform: face.transform }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Angle Display */}
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono mb-2">
                H: {horizontalAngle}° | V: {verticalAngle}° | Z: {zoomLevel > 0 ? '+' : ''}{zoomLevel}%
              </div>

              {/* Natural Language Display */}
              <div className="text-center text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded p-2 leading-relaxed">
                <div className="font-medium text-orange-600 dark:text-orange-400 mb-1">
                  {translateHorizontalRotation(horizontalAngle).toUpperCase()}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">
                  {translateVerticalAngle(verticalAngle)}
                </div>
              </div>
            </div>

            {/* Camera Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm p-4 space-y-4">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Camera Settings
              </h3>

              {/* Zoom */}
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                  Zoom: {zoomLevel > 0 ? '+' : ''}{zoomLevel}%
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* FOV */}
              <div>
                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                  Field of View: {fov}°
                </label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateView}
              disabled={!uploadedImage || isGenerating}
              className={`w-full py-3 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                uploadedImage && !isGenerating
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Generating...
                </>
              ) : (
                'Generate View'
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setHorizontalAngle(0);
                setVerticalAngle(0);
                setZoomLevel(0);
                setFov(45);
              }}
              disabled={isGenerating}
              className="w-full py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Reset Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
