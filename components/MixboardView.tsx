import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Image as ImageIcon, Type, Trash2, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { GenerationConfig } from '../types';

interface CanvasImage {
  id: string;
  dataUri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  originalWidth: number;
  originalHeight: number;
}

interface MixboardViewProps {
  theme: 'dark' | 'light';
  onImageGenerated?: (imageDataUri: string) => void;
}

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

export const MixboardView: React.FC<MixboardViewProps> = ({ theme, onImageGenerated }) => {
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [isGenerating, setIsGenerating] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizingImage, setResizingImage] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image generation
  const handleGenerate = async () => {
    if (!prompt && canvasImages.filter(img => img.selected).length === 0) return;

    setIsGenerating(true);

    try {
      const selectedImages = canvasImages.filter(img => img.selected);
      const referenceImages = selectedImages.length > 0
        ? selectedImages.map(img => img.dataUri)
        : undefined;

      const output = await GeminiService.generateImage(
        prompt || 'Continue the creative exploration',
        config,
        undefined,
        referenceImages,
        'Mixboard User'
      );

      if (output.images && output.images.length > 0) {
        const imageDataUri = `data:image/png;base64,${output.images[0]}`;

        // Add generated image to canvas
        const img = new Image();
        img.onload = () => {
          const newImage: CanvasImage = {
            id: `img-${Date.now()}`,
            dataUri: imageDataUri,
            x: 100 + (canvasImages.length * 50),
            y: 100 + (canvasImages.length * 50),
            width: 300,
            height: (300 * img.height) / img.width,
            selected: false,
            originalWidth: img.width,
            originalHeight: img.height
          };
          setCanvasImages(prev => [...prev, newImage]);

          if (onImageGenerated) {
            onImageGenerated(imageDataUri);
          }
        };
        img.src = imageDataUri;
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generation failed: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const newImage: CanvasImage = {
            id: `img-${Date.now()}-${Math.random()}`,
            dataUri,
            x: 100 + (canvasImages.length * 50),
            y: 100 + (canvasImages.length * 50),
            width: 300,
            height: (300 * img.height) / img.width,
            selected: false,
            originalWidth: img.width,
            originalHeight: img.height
          };
          setCanvasImages(prev => [...prev, newImage]);
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Handle drag and drop from outside
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const dropX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
          const dropY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

          const newImage: CanvasImage = {
            id: `img-${Date.now()}-${index}`,
            dataUri,
            x: dropX,
            y: dropY,
            width: 300,
            height: (300 * img.height) / img.width,
            selected: false,
            originalWidth: img.width,
            originalHeight: img.height
          };
          setCanvasImages(prev => [...prev, newImage]);
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle image selection and dragging
  const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();

    const image = canvasImages.find(img => img.id === imageId);
    if (!image) return;

    // Check if clicking on resize handle (bottom-right corner)
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const imageScreenX = image.x * zoom + panOffset.x;
    const imageScreenY = image.y * zoom + panOffset.y;
    const imageScreenWidth = image.width * zoom;
    const imageScreenHeight = image.height * zoom;

    const clickX = e.clientX - canvasRect.left;
    const clickY = e.clientY - canvasRect.top;

    const isResizeHandle =
      clickX >= imageScreenX + imageScreenWidth - 20 &&
      clickX <= imageScreenX + imageScreenWidth &&
      clickY >= imageScreenY + imageScreenHeight - 20 &&
      clickY <= imageScreenY + imageScreenHeight;

    if (isResizeHandle) {
      setResizingImage(imageId);
      setDragStart({ x: clickX, y: clickY });
    } else {
      // Toggle selection with Ctrl/Cmd, otherwise select only this image
      if (e.ctrlKey || e.metaKey) {
        setCanvasImages(prev => prev.map(img =>
          img.id === imageId ? { ...img, selected: !img.selected } : img
        ));
      } else {
        setCanvasImages(prev => prev.map(img => ({
          ...img,
          selected: img.id === imageId
        })));
      }

      setDraggedImage(imageId);
      setDragStart({ x: clickX, y: clickY });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      // Start panning with middle mouse or space+left click
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (e.button === 0) {
        // Start box selection
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;

        const startX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
        const startY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

        setIsSelecting(true);
        setSelectionBox({ startX, startY, endX: startX, endY: startY });

        // Clear selection if not holding Ctrl/Cmd
        if (!e.ctrlKey && !e.metaKey) {
          setCanvasImages(prev => prev.map(img => ({ ...img, selected: false })));
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (resizingImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

      setCanvasImages(prev => prev.map(img => {
        if (img.id === resizingImage) {
          const newWidth = Math.max(50, img.width + dx);
          const aspectRatio = img.originalHeight / img.originalWidth;
          return {
            ...img,
            width: newWidth,
            height: newWidth * aspectRatio
          };
        }
        return img;
      }));

      setDragStart({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
    } else if (draggedImage && dragStart) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const dx = (e.clientX - canvasRect.left - dragStart.x) / zoom;
      const dy = (e.clientY - canvasRect.top - dragStart.y) / zoom;

      setCanvasImages(prev => prev.map(img => {
        if (img.selected || img.id === draggedImage) {
          return {
            ...img,
            x: img.x + dx,
            y: img.y + dy
          };
        }
        return img;
      }));

      setDragStart({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
    } else if (isSelecting && selectionBox) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const endX = (e.clientX - canvasRect.left - panOffset.x) / zoom;
      const endY = (e.clientY - canvasRect.top - panOffset.y) / zoom;

      setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);

      // Update selection
      const minX = Math.min(selectionBox.startX, endX);
      const maxX = Math.max(selectionBox.startX, endX);
      const minY = Math.min(selectionBox.startY, endY);
      const maxY = Math.max(selectionBox.startY, endY);

      setCanvasImages(prev => prev.map(img => {
        const imgCenterX = img.x + img.width / 2;
        const imgCenterY = img.y + img.height / 2;
        const intersects =
          imgCenterX >= minX && imgCenterX <= maxX &&
          imgCenterY >= minY && imgCenterY <= maxY;

        return { ...img, selected: intersects || (e.ctrlKey || e.metaKey ? img.selected : false) };
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggedImage(null);
    setResizingImage(null);
    setIsSelecting(false);
    setSelectionBox(null);
    setIsPanning(false);
    setDragStart(null);
  };

  // Delete selected images
  const handleDeleteSelected = () => {
    setCanvasImages(prev => prev.filter(img => !img.selected));
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCanvasImages(prev => prev.map(img => ({ ...img, selected: true })));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedCount = canvasImages.filter(img => img.selected).length;

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="text-orange-500" size={24} />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mixboard</h1>
          <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded font-medium">
            Experimental Beta
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create, compose, and remix images on an infinite canvas
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-crosshair canvas-background"
          style={{
            backgroundImage: theme === 'dark'
              ? 'radial-gradient(circle, #27272a 1px, transparent 1px)'
              : 'radial-gradient(circle, #e4e4e7 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Canvas Images */}
          {canvasImages.map(image => (
            <div
              key={image.id}
              className={`absolute cursor-move ${image.selected ? 'ring-4 ring-orange-500' : 'ring-1 ring-zinc-300 dark:ring-zinc-700'}`}
              style={{
                left: `${image.x * zoom + panOffset.x}px`,
                top: `${image.y * zoom + panOffset.y}px`,
                width: `${image.width * zoom}px`,
                height: `${image.height * zoom}px`,
                transformOrigin: 'top left'
              }}
              onMouseDown={(e) => handleImageMouseDown(e, image.id)}
            >
              <img
                src={image.dataUri}
                alt="Canvas item"
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
              {image.selected && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 cursor-nwse-resize" />
              )}
            </div>
          ))}

          {/* Selection Box */}
          {isSelecting && selectionBox && (
            <div
              className="absolute border-2 border-orange-500 bg-orange-500/10 pointer-events-none"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.endX) * zoom + panOffset.x}px`,
                top: `${Math.min(selectionBox.startY, selectionBox.endY) * zoom + panOffset.y}px`,
                width: `${Math.abs(selectionBox.endX - selectionBox.startX) * zoom}px`,
                height: `${Math.abs(selectionBox.endY - selectionBox.startY) * zoom}px`
              }}
            />
          )}

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ZoomIn size={16} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <ZoomOut size={16} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <div className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow text-xs text-zinc-700 dark:text-zinc-300">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Selection Info */}
          {selectedCount > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              <div className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow text-sm text-zinc-700 dark:text-zinc-300">
                {selectedCount} selected
              </div>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar - Generation Controls */}
        <div className="w-96 border-l border-zinc-200 dark:border-zinc-800 p-6 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">Generation</h3>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowImageInput(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border transition-colors ${
                !showImageInput
                  ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                  : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
              }`}
            >
              <Type size={16} />
              Text
            </button>
            <button
              onClick={() => setShowImageInput(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border transition-colors ${
                showImageInput
                  ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                  : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
              }`}
            >
              <ImageIcon size={16} />
              Image
            </button>
          </div>

          {/* Prompt Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={selectedCount > 0 ? "Describe how to transform selected images..." : "Describe an image to generate..."}
              className="w-full h-32 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Selected Images Info */}
          {selectedCount > 0 && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {selectedCount} image{selectedCount > 1 ? 's' : ''} selected and will be used as reference
              </p>
            </div>
          )}

          {/* Model Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
              Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="gemini-2.5-flash-image">Flash (Free, Fast)</option>
              <option value="gemini-3-pro-image-preview">Pro (Paid, Higher Quality)</option>
            </select>
          </div>

          {/* Aspect Ratio */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['1:1', '16:9', '9:16', '3:4', '4:3'].map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setConfig(prev => ({ ...prev, aspect_ratio: ratio }))}
                  className={`py-2 px-3 rounded border transition-colors text-sm ${
                    config.aspect_ratio === ratio
                      ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                      : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Images */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400 hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
            >
              <ImageIcon size={16} />
              Upload Images
            </button>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 transition-all ${
              isGenerating
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg'
            }`}
          >
            {isGenerating ? (
              'Generating...'
            ) : (
              <>
                <Sparkles size={18} />
                Generate
              </>
            )}
          </button>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Tips:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Drag & drop images from your computer</li>
              <li>Click to select, Ctrl+Click for multi-select</li>
              <li>Drag to move, resize from bottom-right corner</li>
              <li>Selected images are used in generation</li>
              <li>Shift+Drag to pan canvas</li>
              <li>Delete key to remove selected images</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};