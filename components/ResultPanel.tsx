import React from 'react';
import { Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Generation, ImageRecord } from '../types';

interface ResultPanelProps {
  isGenerating: boolean;
  generation: Generation | null;
  outputImage: ImageRecord | null;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ isGenerating, generation, outputImage }) => {
  
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

  if (!generation || !outputImage) {
    return (
      <div className="h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 p-8 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mb-4">
            <ExternalLink size={24} className="opacity-50" />
        </div>
        <p className="text-sm">Generated image will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-sm">
      <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4">
        {/* Checkered pattern for transparent images usually, but good for generic bg */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        <img 
            src={outputImage.data_uri} 
            alt="Generated Output" 
            className="relative max-w-full max-h-full object-contain shadow-xl rounded-sm"
        />
      </div>
      <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center">
        <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Output</p>
            <p className="text-sm text-zinc-800 dark:text-zinc-300 font-mono">{generation.parameters.image_size} • {generation.parameters.aspect_ratio}</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                   const link = document.createElement('a');
                   link.href = outputImage.data_uri;
                   link.download = `gen-${generation.generation_id}.png`;
                   link.click();
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors shadow-sm"
            >
                <Download size={16} />
                Download
            </button>
        </div>
      </div>
    </div>
  );
};