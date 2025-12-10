import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
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
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string, thumbnailPath?: string) => string | null;
}

// Memoized lazy-loading image card component
const LazyImageCard = React.memo(({
  item,
  isSelected,
  loadImage,
  onSelectGeneration,
  onExportImage
}: {
  item: HistoryGalleryItem;
  isSelected: boolean;
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string, thumbnailPath?: string) => string | null;
  onSelectGeneration: (sessionId: string, generation: SessionGeneration) => void;
  onExportImage: (filename: string) => void;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use IntersectionObserver for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const hasText = item.texts.length > 0;
  const textPreview = hasText ? item.texts.join('\n').slice(0, 180) : '';
  const textCount = item.texts.length;

  // Only load image when visible
  const outputDataUri = useMemo(() => {
    if (!isVisible) return null;
    return item.kind === 'image'
      ? loadImage('output', item.output.id, item.output.filename, item.output.thumbnailPath)
      : null;
  }, [isVisible, item, loadImage]);

  const handleClick = useCallback(() => {
    onSelectGeneration(item.sessionId, item.generation);
  }, [item.sessionId, item.generation, onSelectGeneration]);

  const handleExport = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.kind === 'image') {
      onExportImage(item.output.filename);
    }
  }, [item, onExportImage]);

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className={`group border rounded-lg overflow-hidden cursor-pointer transition-all backdrop-blur-sm ${
        isSelected
          ? 'border-blue-500 shadow-lg shadow-blue-500/10'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md'
      }`}
    >
      <div className="relative bg-zinc-100 dark:bg-zinc-900 aspect-square">
        {!isVisible ? (
          // Placeholder while not visible
          <div className="h-full w-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
            <Image size={32} />
          </div>
        ) : item.kind === 'image' ? (
          outputDataUri ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-400 animate-pulse">
                  <Image size={32} />
                </div>
              )}
              <img
                src={outputDataUri}
                alt="Output"
                className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
              />
            </>
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
            onClick={handleExport}
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
});

LazyImageCard.displayName = 'LazyImageCard';

// Virtual list component for better performance with many items
const VirtualGrid = React.memo(({
  items,
  selectedGenerationId,
  loadImage,
  onSelectGeneration,
  onExportImage,
  itemHeight = 320, // Approximate height of each card
  overscan = 4 // Number of items to render outside viewport
}: {
  items: HistoryGalleryItem[];
  selectedGenerationId?: string;
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string, thumbnailPath?: string) => string | null;
  onSelectGeneration: (sessionId: string, generation: SessionGeneration) => void;
  onExportImage: (filename: string) => void;
  itemHeight?: number;
  overscan?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  // Calculate visible items based on scroll position
  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    // Calculate columns based on responsive grid
    let columns = 1;
    if (containerWidth >= 1280) columns = 4;
    else if (containerWidth >= 1024) columns = 3;
    else if (containerWidth >= 640) columns = 2;

    const rowHeight = itemHeight;
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight);

    const start = Math.max(0, (startRow - overscan) * columns);
    const end = Math.min(items.length, (endRow + overscan) * columns);

    setVisibleRange({ start, end });
  }, [items.length, itemHeight, overscan]);

  // Update on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateVisibleRange();

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Also update on resize
    const resizeObserver = new ResizeObserver(() => {
      updateVisibleRange();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateVisibleRange]);

  // Render only visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange.start, visibleRange.end]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.start + index;
          const isSelected = item.generation.generation_id === selectedGenerationId;

          return (
            <LazyImageCard
              key={`${item.generation.generation_id}-${item.kind === 'image' ? item.output.id : 'text'}-${actualIndex}`}
              item={item}
              isSelected={isSelected}
              loadImage={loadImage}
              onSelectGeneration={onSelectGeneration}
              onExportImage={onExportImage}
            />
          );
        })}
      </div>
    </div>
  );
});

VirtualGrid.displayName = 'VirtualGrid';

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  items,
  onSelectGeneration,
  selectedGenerationId,
  onExportImage,
  loadImage
}) => {
  // Memoize the loadImage function to prevent unnecessary re-renders
  const memoizedLoadImage = useCallback(loadImage, [loadImage]);

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

  // For small lists (< 50 items), use simple grid without virtualization
  if (items.length < 50) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((item) => {
            const isSelected = item.generation.generation_id === selectedGenerationId;

            return (
              <LazyImageCard
                key={`${item.generation.generation_id}-${item.kind === 'image' ? item.output.id : 'text'}`}
                item={item}
                isSelected={isSelected}
                loadImage={memoizedLoadImage}
                onSelectGeneration={onSelectGeneration}
                onExportImage={onExportImage}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // For larger lists, use virtual grid
  return (
    <VirtualGrid
      items={items}
      selectedGenerationId={selectedGenerationId}
      loadImage={memoizedLoadImage}
      onSelectGeneration={onSelectGeneration}
      onExportImage={onExportImage}
    />
  );
};
