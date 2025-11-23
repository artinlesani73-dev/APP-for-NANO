import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
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
        <label className="text-sm font-medium text-zinc-300">{title}</label>
      </div>
      
      <div 
        className={`relative border-2 border-dashed rounded-lg transition-all h-40 flex flex-col items-center justify-center
        ${image 
            ? 'border-blue-500/50 bg-zinc-900' 
            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 bg-zinc-900/50'
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
                    className="bg-red-500/20 text-red-400 p-2 rounded-full hover:bg-red-500/40 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
            <div className="absolute bottom-2 right-2 bg-black/80 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded">
                {image.metadata.mime_type.split('/')[1].toUpperCase()}
            </div>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-400 w-full h-full"
          >
            <ImageIcon size={24} className="mb-2 opacity-50" />
            <span className="text-xs font-medium">Click to upload</span>
            <span className="text-[10px] opacity-60 mt-1 max-w-[120px] text-center">{description}</span>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
