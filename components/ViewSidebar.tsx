import React from 'react';
import { Sparkles, Network, History } from 'lucide-react';

interface ViewSidebarProps {
  showGraphView: boolean;
  showHistory: boolean;
  historyCount: number;
  onToggleGraphView: () => void;
  onToggleHistory: () => void;
  onToggleMixboard: () => void;
  theme: 'dark' | 'light';
}

export function ViewSidebar({
  showGraphView,
  showHistory,
  historyCount,
  onToggleGraphView,
  onToggleHistory,
  onToggleMixboard,
  theme
}: ViewSidebarProps) {
  const isInMixboard = !showGraphView && !showHistory;

  return (
    <div className="w-16 h-full bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-4 gap-3">
      {/* Mixboard Button */}
      <button
        onClick={onToggleMixboard}
        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all ${
          isInMixboard
            ? 'bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400 shadow-sm'
            : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
        title="Mixboard"
      >
        <Sparkles size={20} />
        <span className="text-[9px] font-medium mt-0.5">Mix</span>
      </button>

      {/* Graph View Button */}
      <button
        onClick={onToggleGraphView}
        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all ${
          showGraphView
            ? 'bg-purple-100 dark:bg-purple-950/50 border-purple-300 dark:border-purple-900 text-purple-700 dark:text-purple-400 shadow-sm'
            : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
        title="Graph View"
      >
        <Network size={20} />
        <span className="text-[9px] font-medium mt-0.5">Graph</span>
      </button>

      {/* Gallery Button */}
      <button
        onClick={onToggleHistory}
        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border transition-all relative ${
          showHistory
            ? 'bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-900 text-blue-700 dark:text-blue-400 shadow-sm'
            : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
        title={`Gallery (${historyCount} items)`}
      >
        <History size={20} />
        <span className="text-[9px] font-medium mt-0.5">
          {historyCount > 99 ? '99+' : historyCount}
        </span>
      </button>
    </div>
  );
}
