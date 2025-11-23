import React from 'react';
import { Sparkles } from 'lucide-react';

interface PromptPanelProps {
  prompt: string;
  setPrompt: (val: string) => void;
}

export const PromptPanel: React.FC<PromptPanelProps> = ({ prompt, setPrompt }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-3 shadow-sm transition-colors">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-300 flex items-center gap-2">
          <Sparkles size={14} className="text-yellow-500" />
          Prompt
        </label>
        <span className={`text-xs font-medium ${prompt.length > 2000 ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {prompt.length} / 2000
        </span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image you want to generate in detail..."
        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-950 resize-y min-h-[120px] shadow-inner"
        maxLength={2000}
      />
      <div className="flex gap-2">
         {/* Simple suggestion chips mock */}
         {['Photorealistic', 'Cyberpunk', 'Oil Painting', 'Minimalist'].map(style => (
             <button 
                key={style}
                onClick={() => setPrompt(prompt + (prompt ? ', ' : '') + style)}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded transition-colors"
             >
                 + {style}
             </button>
         ))}
      </div>
    </div>
  );
};