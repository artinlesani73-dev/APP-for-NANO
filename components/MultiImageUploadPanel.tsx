import React, { useRef, useState } from 'react';
import { X, Image as ImageIcon, Plus, Square } from 'lucide-react';

interface MultiImageUploadPanelProps {
  title: string;
  images: string[]; // Array of base64 data URIs
  onUpload: (file: File) => void;
  onRemove: (index: number) => void;
  onEdit?: (index: number) => void;
  onCreateBlank?: () => void;
  accept?: string;
  description?: string;
  maxImages?: number;
}

export const MultiImageUploadPanel: React.FC<MultiImageUploadPanelProps> = ({
  title,
  images,
  onUpload,
  onRemove,
  onEdit,
  onCreateBlank,
  accept = "image/png, image/jpeg, image/webp",
  description,
  maxImages = 5
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && images.length < maxImages) {
      onUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < maxImages) {
      setIsDragging(true);
    }
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

    if (images.length >= maxImages) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onUpload(file);
      }
    }
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</label>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {images.length} / {maxImages}
        </span>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-2">
        {images.map((imageData, index) => (
          <div
            key={index}
            className="relative border-2 border-blue-500/50 bg-zinc-50 dark:bg-zinc-900 rounded-lg overflow-hidden h-32 group"
          >
            <img
              src={imageData}
              alt={`${title} ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(index)}
                  className="bg-white/10 backdrop-blur text-white p-2 rounded-full hover:bg-blue-500/80 transition-colors"
                  title="Edit image"
                >
                  <ImageIcon size={16} />
                </button>
              )}
              <button
                onClick={() => onRemove(index)}
                className="bg-white/10 backdrop-blur text-white p-2 rounded-full hover:bg-red-500/80 transition-colors"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
            <div className="absolute top-1 right-1 bg-black/80 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
              {index + 1}
            </div>
          </div>
        ))}

        {/* Add More Button */}
        {canAddMore && (
          <div
            className={`relative border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center transition-all
            ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging ? (
              <>
                <Plus size={20} className="text-zinc-400 dark:text-zinc-500 mb-1" />
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block text-center px-2">
                  Drop here
                </span>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-2 rounded transition-colors"
                    title="Upload image"
                  >
                    <Plus size={16} />
                  </button>
                  {onCreateBlank && (
                    <button
                      onClick={onCreateBlank}
                      className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-2 rounded transition-colors"
                      title="Create blank canvas"
                    >
                      <Square size={16} />
                    </button>
                  )}
                </div>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block text-center px-2">
                  {images.length === 0 ? 'Upload or create blank' : 'Add more'}
                </span>
                {images.length === 0 && description && (
                  <span className="text-[10px] opacity-60 mt-1 block max-w-[100px] leading-tight text-center">
                    {description}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        style={{ display: 'none' }}
        accept={accept}
        onChange={handleFileChange}
      />
    </div>
  );
};
