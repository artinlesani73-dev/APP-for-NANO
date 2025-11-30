import React from 'react';
import { SessionGeneration, StoredImageMeta } from '../types';
import { Clock, Image, Download, TextQuote, FileText } from 'lucide-react';

export type HistoryGalleryItem =
  | {
      kind: 'image';
      sessionId: string;
      sessionTitle: string;
      generation: SessionGeneration;
      output: StoredImageMeta;
      outputIndex: number;
      texts: string[];
    }
  | {
      kind: 'text';
      sessionId: string;
      sessionTitle: string;
      generation: SessionGeneration;
      texts: string[];
    };

interface HistoryPanelProps {
  items: HistoryGalleryItem[];
  onSelectGeneration: (sessionId: string, generation: SessionGeneration) => void;
  selectedGenerationId?: string;
  onExportImage: (filename: string) => void;
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  items,
  onSelectGeneration,
  selectedGenerationId,
  onExportImage,
  loadImage
}) => {

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400">
        <div className="text-center">
          <Image size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">No generations yet</p>
          <p className="text-xs mt-1">Create your first image to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {items.map((item) => {
          const isSelected = item.generation.generation_id === selectedGenerationId;
          const outputDataUri =
            item.kind === 'image'
              ? loadImage('output', item.output.id, item.output.filename)
              : null;
          const hasText = item.texts.length > 0;
          const textPreview = hasText ? item.texts.join('\n').slice(0, 180) : '';
          const textCount = item.texts.length;

          return (
            <div
              key={`${item.generation.generation_id}-${item.kind === 'image' ? item.output.id : 'text'}`}
              onClick={() => onSelectGeneration(item.sessionId, item.generation)}
              className={`group border rounded-lg overflow-hidden cursor-pointer transition-all backdrop-blur-sm ${
                isSelected
                  ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md'
              }`}
            >
              <div className="relative bg-zinc-100 dark:bg-zinc-900 aspect-square">
                {item.kind === 'image' ? (
                  outputDataUri ? (
                    <img
                      src={outputDataUri}
                      alt="Output"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-400">
                      <Image size={32} />
                    </div>
                  )
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 text-zinc-500 dark:text-zinc-400">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-3">
                      <FileText size={20} />
                    </div>
                    <p className="text-xs leading-relaxed line-clamp-4">
                      {textPreview}
                    </p>
                  </div>
                )}

                <div className="absolute top-2 left-2 flex flex-wrap gap-2 text-[10px] font-medium">
                  <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/60 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    {item.sessionTitle || 'Untitled'}
                  </span>
                  {hasText && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <TextQuote size={12} />
                      {textCount}
                    </span>
                  )}
                  {item.kind === 'image' && item.outputIndex > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      Output {item.outputIndex + 1}
                    </span>
                  )}
                </div>

                <div className="absolute bottom-2 left-2 text-[11px] text-white flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-1 rounded-full">
                  <Clock size={12} />
                  <span>{new Date(item.generation.timestamp).toLocaleString()}</span>
                </div>

                {item.kind === 'image' && outputDataUri && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportImage(item.output.filename);
                    }}
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] flex items-center gap-1 bg-white/90 dark:bg-black/70 text-zinc-800 dark:text-zinc-100 px-2 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  >
                    <Download size={12} />
                    Export
                  </button>
                )}
              </div>

              <div className="p-3 space-y-2 bg-white/60 dark:bg-zinc-950/50">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-2 font-medium">{item.generation.prompt}</p>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    {item.generation.parameters.image_size} • {item.generation.parameters.aspect_ratio}
                  </span>
                  {item.generation.generation_time_ms && (
                    <span>{item.generation.generation_time_ms}ms</span>
                  )}
                </div>
                {hasText && (
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-100/70 dark:bg-zinc-800/60 rounded p-2 border border-zinc-200 dark:border-zinc-700">
                    <p className="font-semibold text-xs mb-1 flex items-center gap-1">
                      <TextQuote size={12} />
                      {textCount === 1 ? 'Text output' : `${textCount} text outputs`}
                    </p>
                    <p className="line-clamp-3 leading-relaxed text-xs">{textPreview}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
