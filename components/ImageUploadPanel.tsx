import React, { useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { ImageRecord } from '../types';

interface ImageUploadPanelProps {
  title: string;
  image: ImageRecord | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  accept?: string;
  description?: string;
}

export const ImageUploadPanel: React.FC<ImageUploadPanelProps> = ({
  title,
  image,
  onUpload,
  onRemove,
  accept = "image/png, image/jpeg, image/webp",
  description
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</label>
      </div>
      
      <div 
        className={`relative border-2 border-dashed rounded-lg transition-all h-40 flex flex-col items-center justify-center overflow-hidden
        ${image 
            ? 'border-blue-500/50 bg-zinc-50 dark:bg-zinc-900' 
            : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
        }`}
      >
        {image ? (
          <div className="relative w-full h-full p-2 group">
            <img 
              src={image.data_uri} 
              alt={title} 
              className="w-full h-full object-contain rounded"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <button 
                    onClick={onRemove}
                    className="bg-white/10 backdrop-blur text-white p-2 rounded-full hover:bg-red-500/80 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
            {image.metadata?.mime_type && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  {image.metadata.mime_type.split('/')[1].toUpperCase()}
              </div>
            )}
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 w-full h-full p-4 text-center"
          >
            <ImageIcon size={24} className="mb-2 opacity-40" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block">Click to upload</span>
            <span className="text-[10px] opacity-60 mt-1 block max-w-[120px] leading-tight">{description}</span>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden" 
          style={{ display: 'none' }} /* Inline style backup if Tailwind fails to load */
          accept={accept}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};