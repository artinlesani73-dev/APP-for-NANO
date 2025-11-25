import React from 'react';
import { Download, ExternalLink, Loader2, AlertCircle, FileText } from 'lucide-react';
import { SessionGeneration } from '../types';

interface ResultPanelProps {
  isGenerating: boolean;
  generation: SessionGeneration | null;
  outputImages: Array<{ dataUri: string; filename?: string }>;
  outputTexts?: string[];
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ isGenerating, generation, outputImages, outputTexts = [] }) => {

  if (isGenerating) {
    return (
      <div className="h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center p-8 space-y-4 shadow-sm">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-500" size={48} />
        <div className="text-center">
            <h3 className="text-zinc-800 dark:text-zinc-200 font-medium">Generating Artifact...</h3>
            <p className="text-zinc-500 text-sm mt-2">Running complex inference on Gemini models.</p>
        </div>
      </div>
    );
  }

  if (generation?.status === 'failed') {
      return (
        <div className="h-full w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="text-red-500 mb-4" size={48} />
            <h3 className="text-red-800 dark:text-red-400 font-medium">Generation Failed</h3>
            <p className="text-red-600 dark:text-red-500/60 text-sm mt-2 max-w-md">{generation.error || "An unknown error occurred."}</p>
        </div>
      );
  }

  const hasText = outputTexts.length > 0;
  const hasImages = outputImages.length > 0;

  if (!generation || (!hasImages && !hasText)) {
    return (
      <div className="h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mb-4">
            <ExternalLink size={24} className="opacity-50" />
        </div>
        <p className="text-sm">Generated output will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-sm">
      <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-950 overflow-y-auto p-4 space-y-4">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>

        {hasImages && (
          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Images</p>
                <p className="text-sm text-zinc-800 dark:text-zinc-300 font-mono">{generation.parameters.image_size} • {generation.parameters.aspect_ratio}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {outputImages.map((image, idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow">
                  <div className="bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-2">
                    <img
                      src={image.dataUri}
                      alt={`Generated Output ${idx + 1}`}
                      className="max-h-80 w-full object-contain rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{image.filename || `Output-${idx + 1}`}</p>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = image.dataUri;
                        link.download = image.filename || `gen-${generation.generation_id}-${idx + 1}.png`;
                        link.click();
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasText && (
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider font-bold">
              <FileText size={14} />
              Text Outputs
            </div>
            <div className="space-y-3">
              {outputTexts.map((text, idx) => (
                <div key={idx} className="p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 shadow-sm">
                  <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};