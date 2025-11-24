import React from 'react';
import { SessionGeneration } from '../types';
import { Clock, Image, Download, CheckCircle2, XCircle, Loader2, Network } from 'lucide-react';
import GraphView from './GraphView';

interface HistoryPanelProps {
  generations: SessionGeneration[];
  onSelectGeneration: (generation: SessionGeneration) => void;
  selectedGenerationId?: string;
  onExportImage: (filename: string) => void;
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
  viewMode: 'list' | 'graph';
  theme: 'dark' | 'light';
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  generations,
  onSelectGeneration,
  selectedGenerationId,
  onExportImage,
  loadImage,
  viewMode,
  theme
}) => {

  if (generations.length === 0) {
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

  const selectedGeneration = generations.find(g => g.generation_id === selectedGenerationId);

  return (
    <div className="h-full flex flex-col">

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto space-y-3 p-4 pt-2">
          {generations.slice().reverse().map((gen) => {
        const isSelected = gen.generation_id === selectedGenerationId;
        const outputDataUri = gen.output_image
          ? loadImage('output', gen.output_image.id, gen.output_image.filename)
          : null;

        return (
          <div
            key={gen.generation_id}
            onClick={() => onSelectGeneration(gen)}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50'
            }`}
          >
            {/* Status & Time */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs">
                {gen.status === 'completed' && (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
                {gen.status === 'failed' && (
                  <XCircle size={14} className="text-red-500" />
                )}
                {gen.status === 'pending' && (
                  <Loader2 size={14} className="text-blue-500 animate-spin" />
                )}
                <span className="text-zinc-500 dark:text-zinc-400">
                  {gen.status}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <Clock size={12} />
                <span>{new Date(gen.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Thumbnail */}
            {outputDataUri && (
              <div className="mb-2 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={outputDataUri}
                  alt="Output"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}

            {/* Prompt */}
            <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2 mb-2">
              {gen.prompt}
            </p>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                {gen.control_images && gen.control_images.length > 0 && (
                  <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded">
                    Control ({gen.control_images.length})
                  </span>
                )}
                {gen.reference_images && gen.reference_images.length > 0 && (
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded">
                    Reference ({gen.reference_images.length})
                  </span>
                )}
              </div>
              {gen.generation_time_ms && (
                <span>{gen.generation_time_ms}ms</span>
              )}
            </div>

            {/* Export Button */}
            {gen.output_image && gen.status === 'completed' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExportImage(gen.output_image!.filename);
                }}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download size={12} />
                Export Image
              </button>
            )}

            {/* Error */}
            {gen.error && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-400">
                {gen.error}
              </div>
            )}
          </div>
        );
      })}
        </div>
      )}

      {/* Graph View */}
      {viewMode === 'graph' && (
        <div className="flex-1 overflow-hidden">
          {selectedGeneration ? (
            <GraphView
              generation={selectedGeneration}
              theme={theme}
              loadImage={loadImage}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <div className="text-center">
                <Network size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">No generation selected</p>
                <p className="text-xs mt-1">Select a generation from the list view to see its graph</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
