# Mixboard Migration Plan

**Document Version:** 1.0
**Date:** 2025-11-29
**Status:** Planning Phase

## Executive Summary

This document outlines the complete migration strategy from the current Generation View to a fully-featured Mixboard system. The migration involves:

1. Unifying the image input system (removing control/reference distinction)
2. Adding generation history and graph tracking to Mixboard
3. Migrating existing session data to the new format
4. Enabling output-to-input workflow for iterative creation

---

## Table of Contents

- [Phase 1: Data Model & Storage Analysis](#phase-1-data-model--storage-analysis)
- [Phase 2: Migration Utility](#phase-2-migration-utility)
- [Phase 3: Update Mixboard to Save History](#phase-3-update-mixboard-to-save-history)
- [Phase 4: Graph View Integration](#phase-4-graph-view-integration)
- [Phase 5: Output → Input Workflow](#phase-5-output--input-workflow)
- [Phase 6: Update Type Definitions](#phase-6-update-type-definitions)
- [Phase 7: UI Updates](#phase-7-ui-updates)
- [Phase 8: Testing & Migration](#phase-8-testing--migration)
- [Phase 9: Remove Old Generation View](#phase-9-remove-old-generation-view)
- [Implementation Timeline](#implementation-timeline)
- [Risk Assessment](#risk-assessment)

---

## Phase 1: Data Model & Storage Analysis

### 1.1 Current Storage Schema

**Files to examine:**
- `/services/newStorageService.ts`
- `/types.ts`

**Current Structure:**
```typescript
interface SessionGeneration {
  generation_id: string;
  timestamp: string;
  prompt: string;
  control_images?: ImageMeta[];    // Structure/composition
  reference_images?: ImageMeta[];  // Style transfer
  output_images?: ImageMeta[];
  output_image?: ImageMeta;        // Legacy single output
  output_texts?: string[];
  parameters: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  generation_time_ms?: number;
}

interface Session {
  session_id: string;
  title: string;
  generations: SessionGeneration[];
  user?: { id: string; displayName: string };
  created_at: string;
  updated_at: string;
}
```

**Issues with Current Design:**
- Artificial separation between control and reference images
- No canvas state preservation
- No parent-child relationship tracking between generations
- Single linear history per session

### 1.2 New Mixboard Session Format

**Proposed Structure:**
```typescript
interface CanvasImage {
  id: string;                      // Unique canvas image ID
  dataUri: string;                 // Base64 image data
  x: number;                       // Canvas X position
  y: number;                       // Canvas Y position
  width: number;                   // Display width
  height: number;                  // Display height
  selected: boolean;               // Selection state
  originalWidth: number;           // Original image width
  originalHeight: number;          // Original image height
  generationId?: string;           // Parent generation ID
  imageMetaId?: string;            // Link to ImageMeta for persistence
}

interface MixboardGeneration {
  generation_id: string;
  timestamp: string;
  prompt: string;
  input_images: ImageMeta[];       // UNIFIED: No control/reference split
  output_images: ImageMeta[];
  parameters: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  generation_time_ms?: number;
  canvas_state?: {                 // NEW: Save canvas state
    images: CanvasImage[];         // All images at generation time
    zoom: number;                  // Canvas zoom level
    panOffset: { x: number; y: number };  // Pan position
  };
  parent_generation_ids?: string[];  // NEW: Track lineage for graph
}

interface MixboardSession {
  session_id: string;
  title: string;
  generations: MixboardGeneration[];
  canvas_images: CanvasImage[];    // Current canvas state
  user?: { id: string; displayName: string };
  created_at: string;
  updated_at: string;
}
```

**Key Improvements:**
- ✅ Unified image input (no artificial categories)
- ✅ Canvas state preservation (can restore exact layout)
- ✅ Parent tracking (enables graph view and provenance)
- ✅ Richer metadata for canvas images

---

## Phase 2: Migration Utility

### 2.1 Create Migration Service

**New File:** `/services/migrationService.ts`

**Core Functions:**

```typescript
import { Session, SessionGeneration, ImageMeta } from '../types';
import { MixboardSession, MixboardGeneration } from '../types';

export class MigrationService {
  /**
   * Convert old session format to Mixboard format
   */
  static migrateSession(oldSession: Session): MixboardSession {
    return {
      session_id: oldSession.session_id,
      title: oldSession.title,
      generations: oldSession.generations.map(gen => this.migrateGeneration(gen)),
      canvas_images: [],  // Cannot reconstruct old canvas state
      user: oldSession.user,
      created_at: oldSession.created_at,
      updated_at: oldSession.updated_at
    };
  }

  /**
   * Convert old generation to Mixboard generation
   */
  static migrateGeneration(oldGen: SessionGeneration): MixboardGeneration {
    const inputImages = this.unifyImages(
      oldGen.control_images,
      oldGen.reference_images
    );

    // Handle legacy single output format
    const outputImages = oldGen.output_images ||
                        (oldGen.output_image ? [oldGen.output_image] : []);

    return {
      generation_id: oldGen.generation_id,
      timestamp: oldGen.timestamp,
      prompt: oldGen.prompt,
      input_images: inputImages,
      output_images: outputImages,
      parameters: oldGen.parameters,
      status: oldGen.status,
      error_message: oldGen.error_message,
      generation_time_ms: oldGen.generation_time_ms,
      canvas_state: undefined,  // Cannot reconstruct
      parent_generation_ids: []  // Cannot infer from old data
    };
  }

  /**
   * Merge control_images + reference_images → input_images
   * Preserves order: [control1, control2, ..., reference1, reference2, ...]
   */
  static unifyImages(
    controlImages?: ImageMeta[],
    referenceImages?: ImageMeta[]
  ): ImageMeta[] {
    const unified: ImageMeta[] = [];

    if (controlImages) {
      unified.push(...controlImages);
    }

    if (referenceImages) {
      unified.push(...referenceImages);
    }

    return unified;
  }

  /**
   * Detect if session is old format or new format
   */
  static isLegacySession(session: any): boolean {
    if (!session || !session.generations || session.generations.length === 0) {
      return false;
    }

    const firstGen = session.generations[0];

    // Check for old format indicators
    const hasControlOrReference =
      firstGen.control_images !== undefined ||
      firstGen.reference_images !== undefined;

    // Check for new format indicators
    const hasInputImages = firstGen.input_images !== undefined;

    return hasControlOrReference && !hasInputImages;
  }

  /**
   * Batch migrate all sessions in storage
   */
  static migrateAllSessions(): {
    migrated: number;
    failed: number;
    errors: string[]
  } {
    const result = { migrated: 0, failed: 0, errors: [] as string[] };

    try {
      const allSessions = StorageService.getSessions();

      for (const session of allSessions) {
        try {
          if (this.isLegacySession(session)) {
            const migratedSession = this.migrateSession(session);
            StorageService.saveSession(migratedSession);
            result.migrated++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Failed to migrate session ${session.session_id}: ${error.message}`
          );
        }
      }

      // Set migration flag
      localStorage.setItem('mixboard_migration_completed', 'true');

    } catch (error) {
      result.errors.push(`Migration process failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check if migration has been completed
   */
  static isMigrationCompleted(): boolean {
    return localStorage.getItem('mixboard_migration_completed') === 'true';
  }

  /**
   * Check if any sessions need migration
   */
  static needsMigration(): boolean {
    if (this.isMigrationCompleted()) {
      return false;
    }

    const allSessions = StorageService.getSessions();
    return allSessions.some(session => this.isLegacySession(session));
  }
}
```

### 2.2 Implement Backward Compatibility

**Update StorageService:**

```typescript
// In /services/newStorageService.ts

loadSession(id: string): Session | MixboardSession {
  const session = /* load from localStorage/filesystem */;

  // Auto-migrate legacy sessions on load
  if (MigrationService.isLegacySession(session)) {
    const migrated = MigrationService.migrateSession(session);
    this.saveSession(migrated);  // Persist migrated version
    return migrated;
  }

  return session;
}

getSessions(): Array<Session | MixboardSession> {
  const sessions = /* load all sessions */;

  // Auto-migrate on bulk load
  return sessions.map(session => {
    if (MigrationService.isLegacySession(session)) {
      return MigrationService.migrateSession(session);
    }
    return session;
  });
}
```

---

## Phase 3: Update Mixboard to Save History

### 3.1 Add Generation Tracking to MixboardView

**File:** `/components/MixboardView.tsx`

**Updated Props Interface:**
```typescript
interface MixboardViewProps {
  theme: 'dark' | 'light';
  currentSession: MixboardSession | null;
  onSessionUpdate: (session: MixboardSession) => void;
  onCreateSession?: () => MixboardSession;
}
```

**State Additions:**
```typescript
// Add to MixboardView state
const [generationHistory, setGenerationHistory] = useState<MixboardGeneration[]>([]);
const [currentGeneration, setCurrentGeneration] = useState<MixboardGeneration | null>(null);
```

**Modified handleGenerate Function:**
```typescript
const handleGenerate = async () => {
  if (!prompt && canvasImages.filter(img => img.selected).length === 0) return;

  setIsGenerating(true);

  try {
    const selectedImages = canvasImages.filter(img => img.selected);
    const referenceImages = selectedImages.length > 0
      ? selectedImages.map(img => img.dataUri)
      : undefined;

    // Create generation record BEFORE API call
    const generationId = `gen-${Date.now()}`;
    const newGeneration: MixboardGeneration = {
      generation_id: generationId,
      timestamp: new Date().toISOString(),
      prompt,
      input_images: [], // Will be populated after save
      output_images: [],
      parameters: config,
      status: 'pending',
      canvas_state: {
        images: canvasImages,
        zoom,
        panOffset
      },
      parent_generation_ids: selectedImages
        .map(img => img.generationId)
        .filter(Boolean) as string[]
    };

    setCurrentGeneration(newGeneration);

    // Call API
    const output = await GeminiService.generateImage(
      prompt || 'Continue the creative exploration',
      config,
      undefined,
      referenceImages,
      '<display-name>'
    );

    if (output.images && output.images.length > 0) {
      const imageDataUri = `data:image/png;base64,${output.images[0]}`;

      // Save images to storage and get metadata
      const inputImageMetas = await Promise.all(
        selectedImages.map(async (img) => {
          if (img.imageMetaId) {
            // Already saved, return existing meta
            return StorageService.getImageMeta(img.imageMetaId);
          } else {
            // Save new image
            return StorageService.saveImage('input', img.dataUri);
          }
        })
      );

      const outputImageMeta = await StorageService.saveImage('output', imageDataUri);

      // Complete generation record
      const completedGeneration: MixboardGeneration = {
        ...newGeneration,
        input_images: inputImageMetas,
        output_images: [outputImageMeta],
        status: 'completed',
        generation_time_ms: Date.now() - new Date(newGeneration.timestamp).getTime()
      };

      // Save to session
      const updatedSession = {
        ...currentSession,
        generations: [...currentSession.generations, completedGeneration],
        updated_at: new Date().toISOString()
      };

      onSessionUpdate(updatedSession);

      // Add output to canvas
      const img = new Image();
      img.onload = () => {
        const newCanvasImage: CanvasImage = {
          id: `img-${Date.now()}`,
          dataUri: imageDataUri,
          x: 100 + (canvasImages.length * 50),
          y: 100 + (canvasImages.length * 50),
          width: 300,
          height: (300 * img.height) / img.width,
          selected: false,
          originalWidth: img.width,
          originalHeight: img.height,
          generationId: generationId,
          imageMetaId: outputImageMeta.id
        };
        setCanvasImages(prev => [...prev, newCanvasImage]);
      };
      img.src = imageDataUri;

      setCurrentGeneration(completedGeneration);
      setGenerationHistory(prev => [...prev, completedGeneration]);
    }
  } catch (error) {
    console.error('Generation failed:', error);

    // Mark generation as failed
    const failedGeneration: MixboardGeneration = {
      ...currentGeneration!,
      status: 'failed',
      error_message: (error as Error).message
    };

    setCurrentGeneration(failedGeneration);
  } finally {
    setIsGenerating(false);
  }
};
```

### 3.2 Update Canvas Image Tracking

**Enhanced CanvasImage Interface:**
```typescript
interface CanvasImage {
  id: string;
  dataUri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  originalWidth: number;
  originalHeight: number;
  generationId?: string;  // Track which generation created this
  imageMetaId?: string;   // Link to ImageMeta for persistence
}
```

**Update Image Upload Handler:**
```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  Array.from(files).forEach(async (file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;

      // Save to storage
      const imageMeta = await StorageService.saveImage('upload', dataUri);

      const img = new Image();
      img.onload = () => {
        const newImage: CanvasImage = {
          id: `img-${Date.now()}-${Math.random()}`,
          dataUri,
          x: 100 + (canvasImages.length * 50),
          y: 100 + (canvasImages.length * 50),
          width: 300,
          height: (300 * img.height) / img.width,
          selected: false,
          originalWidth: img.width,
          originalHeight: img.height,
          generationId: undefined,      // User upload, not generated
          imageMetaId: imageMeta.id     // Link to storage
        };
        setCanvasImages(prev => [...prev, newImage]);
      };
      img.src = dataUri;
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
};
```

---

## Phase 4: Graph View Integration

### 4.1 Update GraphView for Mixboard

**File:** `/components/GraphView.tsx`

**Add Mixboard Mode Support:**
```typescript
interface GraphViewProps {
  sessions: Array<Session | MixboardSession>;
  theme: 'dark' | 'light';
  loadImage: (role: string, id: string, filename: string) => string | null;
  onGenerateFromNode?: (/* ... */) => void;
  isMixboardMode?: boolean;  // NEW: Flag for Mixboard rendering
}

// Inside GraphView component
const buildGraphData = () => {
  // ... existing code ...

  session.generations.forEach(gen => {
    // Handle both old and new formats
    const inputImages = 'input_images' in gen
      ? gen.input_images  // Mixboard format
      : [
          ...(gen.control_images || []),
          ...(gen.reference_images || [])
        ];  // Legacy format

    // Build graph nodes...
    // Use parent_generation_ids for edges if available
    if ('parent_generation_ids' in gen && gen.parent_generation_ids) {
      gen.parent_generation_ids.forEach(parentId => {
        edges.push({
          source: parentId,
          target: gen.generation_id,
          type: 'generation'
        });
      });
    }
  });
};

// Update node rendering
const renderImageNode = (image: ImageMeta) => {
  // In Mixboard mode, don't color-code by control/reference
  const borderColor = isMixboardMode
    ? 'border-orange-500'  // All images same color
    : image.role === 'control'
      ? 'border-blue-500'
      : 'border-purple-500';

  // ...
};
```

### 4.2 Add Graph View to Mixboard

**Update MixboardView Header:**
```typescript
const [showGraph, setShowGraph] = useState(false);

// In header section
<button
  onClick={() => setShowGraph(!showGraph)}
  className="flex items-center gap-2 px-3 py-1.5 border rounded"
>
  <Network size={16} />
  {showGraph ? 'Hide Graph' : 'Show Graph'}
</button>
```

**Conditional Rendering:**
```typescript
return (
  <div className="h-full w-full flex flex-col">
    {/* Header */}
    {/* ... */}

    {/* Content */}
    {showGraph ? (
      <GraphView
        sessions={currentSession ? [currentSession] : []}
        theme={theme}
        loadImage={StorageService.loadImage}
        isMixboardMode={true}
      />
    ) : (
      <div className="flex-1 flex">
        {/* Canvas Area */}
        {/* Sidebar */}
      </div>
    )}
  </div>
);
```

---

## Phase 5: Output → Input Workflow

### 5.1 Display Generated Images

**Add Output Display Section:**
```typescript
// In MixboardView sidebar, after Generate button
{currentGeneration?.output_images && currentGeneration.output_images.length > 0 && (
  <div className="mt-4 p-4 border border-zinc-300 dark:border-zinc-700 rounded">
    <h4 className="text-sm font-medium mb-2">Generated Image</h4>
    {currentGeneration.output_images.map((imgMeta, idx) => {
      const dataUri = StorageService.loadImage('output', imgMeta.id, imgMeta.filename);
      return (
        <div key={idx} className="relative group">
          <img
            src={dataUri}
            alt="Generated"
            className="w-full rounded border border-zinc-300 dark:border-zinc-700"
          />
          <button
            onClick={() => addOutputToCanvas(dataUri, imgMeta.id, currentGeneration.generation_id)}
            className="absolute bottom-2 right-2 px-3 py-1 bg-orange-500 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Add to Canvas
          </button>
        </div>
      );
    })}
  </div>
)}
```

### 5.2 Add to Canvas Handler

```typescript
const addOutputToCanvas = (
  imageDataUri: string,
  imageMetaId: string,
  generationId: string
) => {
  const img = new Image();
  img.onload = () => {
    const newImage: CanvasImage = {
      id: `img-${Date.now()}`,
      dataUri: imageDataUri,
      x: 150 + (canvasImages.length * 30),  // Offset from previous
      y: 150 + (canvasImages.length * 30),
      width: 300,
      height: (300 * img.height) / img.width,
      selected: false,
      originalWidth: img.width,
      originalHeight: img.height,
      generationId: generationId,      // Link to parent generation
      imageMetaId: imageMetaId         // Link to storage
    };
    setCanvasImages(prev => [...prev, newImage]);
  };
  img.src = imageDataUri;
};
```

### 5.3 Auto-Add Option

**Alternative: Automatically add to canvas:**
```typescript
// In handleGenerate, after successful generation
if (output.images && output.images.length > 0) {
  const imageDataUri = `data:image/png;base64,${output.images[0]}`;

  // Auto-add to canvas (optional - could be user preference)
  addOutputToCanvas(imageDataUri, outputImageMeta.id, generationId);
}
```

---

## Phase 6: Update Type Definitions

### 6.1 Add New Types

**File:** `/types.ts`

**Add to existing types:**
```typescript
/**
 * Canvas image representation in Mixboard
 */
export interface CanvasImage {
  id: string;
  dataUri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  originalWidth: number;
  originalHeight: number;
  generationId?: string;
  imageMetaId?: string;
}

/**
 * Mixboard generation format (unified image inputs)
 */
export interface MixboardGeneration {
  generation_id: string;
  timestamp: string;
  prompt: string;
  input_images: ImageMeta[];
  output_images: ImageMeta[];
  parameters: GenerationConfig;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  generation_time_ms?: number;
  canvas_state?: {
    images: CanvasImage[];
    zoom: number;
    panOffset: { x: number; y: number };
  };
  parent_generation_ids?: string[];
}

/**
 * Mixboard session format
 */
export interface MixboardSession {
  session_id: string;
  title: string;
  generations: MixboardGeneration[];
  canvas_images: CanvasImage[];
  user?: { id: string; displayName: string };
  created_at: string;
  updated_at: string;
}
```

### 6.2 Deprecation Annotations

```typescript
/**
 * @deprecated Use MixboardGeneration instead.
 * Legacy format with separate control/reference images.
 */
export interface SessionGeneration {
  // ... existing definition ...
}

/**
 * @deprecated Use MixboardSession instead.
 * Legacy session format.
 */
export interface Session {
  // ... existing definition ...
}
```

---

## Phase 7: UI Updates

### 7.1 Generation History Panel

**New Component:** `/components/MixboardHistory.tsx`

```typescript
import React from 'react';
import { MixboardGeneration, CanvasImage } from '../types';
import { Clock, Image as ImageIcon } from 'lucide-react';

interface MixboardHistoryProps {
  generations: MixboardGeneration[];
  onRestoreCanvas: (canvasState: CanvasImage[], zoom: number, panOffset: { x: number; y: number }) => void;
  onLoadGeneration: (generation: MixboardGeneration) => void;
  theme: 'dark' | 'light';
}

export const MixboardHistory: React.FC<MixboardHistoryProps> = ({
  generations,
  onRestoreCanvas,
  onLoadGeneration,
  theme
}) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h3 className="text-lg font-bold">Generation History</h3>

      {generations.length === 0 ? (
        <p className="text-sm text-zinc-500">No generations yet</p>
      ) : (
        <div className="space-y-3">
          {generations.map((gen, idx) => (
            <div
              key={gen.generation_id}
              className="border border-zinc-300 dark:border-zinc-700 rounded p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              onClick={() => onLoadGeneration(gen)}
            >
              {/* Timestamp */}
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                <Clock size={12} />
                {new Date(gen.timestamp).toLocaleString()}
              </div>

              {/* Prompt */}
              <p className="text-sm mb-2 line-clamp-2">{gen.prompt}</p>

              {/* Images */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <ImageIcon size={12} />
                {gen.input_images.length} input → {gen.output_images.length} output
              </div>

              {/* Restore Canvas Button */}
              {gen.canvas_state && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestoreCanvas(
                      gen.canvas_state!.images,
                      gen.canvas_state!.zoom,
                      gen.canvas_state!.panOffset
                    );
                  }}
                  className="mt-2 text-xs px-2 py-1 bg-orange-500 text-white rounded"
                >
                  Restore Canvas State
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### 7.2 Session Management UI

**Add to Mixboard Sidebar:**
```typescript
// Session controls
<div className="mb-4 space-y-2">
  <button
    onClick={handleSaveSession}
    className="w-full py-2 px-4 bg-blue-500 text-white rounded"
  >
    Save Session
  </button>

  <button
    onClick={handleLoadSession}
    className="w-full py-2 px-4 border border-zinc-300 dark:border-zinc-700 rounded"
  >
    Load Session
  </button>

  <button
    onClick={handleExportSession}
    className="w-full py-2 px-4 border border-zinc-300 dark:border-zinc-700 rounded"
  >
    Export as JSON
  </button>

  <button
    onClick={handleClearCanvas}
    className="w-full py-2 px-4 border border-red-300 dark:border-red-700 text-red-600 rounded"
  >
    Clear Canvas
  </button>
</div>
```

---

## Phase 8: Testing & Migration

### 8.1 Unit Tests

**Test File:** `/services/migrationService.test.ts`

```typescript
import { MigrationService } from './migrationService';

describe('MigrationService', () => {
  it('should detect legacy sessions', () => {
    const legacySession = {
      generations: [{
        control_images: [{ id: 'c1' }],
        reference_images: [{ id: 'r1' }]
      }]
    };

    expect(MigrationService.isLegacySession(legacySession)).toBe(true);
  });

  it('should unify control and reference images', () => {
    const control = [{ id: 'c1' }, { id: 'c2' }];
    const reference = [{ id: 'r1' }];

    const unified = MigrationService.unifyImages(control, reference);

    expect(unified).toEqual([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'r1' }
    ]);
  });

  it('should migrate session correctly', () => {
    const legacySession = {
      session_id: 'test-1',
      title: 'Test Session',
      generations: [{
        generation_id: 'gen-1',
        control_images: [{ id: 'c1' }],
        reference_images: [{ id: 'r1' }],
        prompt: 'test'
      }],
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    };

    const migrated = MigrationService.migrateSession(legacySession);

    expect(migrated.generations[0].input_images).toHaveLength(2);
    expect(migrated.generations[0].input_images[0].id).toBe('c1');
    expect(migrated.generations[0].input_images[1].id).toBe('r1');
  });
});
```

### 8.2 Migration Prompt

**In App.tsx:**
```typescript
useEffect(() => {
  const checkMigration = async () => {
    if (MigrationService.needsMigration()) {
      const confirmed = window.confirm(
        'Your sessions need to be migrated to the new Mixboard format.\n\n' +
        'This will:\n' +
        '• Combine control and reference images into a single input format\n' +
        '• Preserve all your existing generations\n' +
        '• Enable new Mixboard features\n\n' +
        'Continue with migration?'
      );

      if (confirmed) {
        const result = MigrationService.migrateAllSessions();

        if (result.failed > 0) {
          console.error('Migration errors:', result.errors);
          alert(
            `Migration completed with some errors.\n` +
            `Migrated: ${result.migrated}\n` +
            `Failed: ${result.failed}\n\n` +
            `Check console for details.`
          );
        } else {
          alert(`Successfully migrated ${result.migrated} session(s)!`);
        }

        window.location.reload();
      }
    }
  };

  checkMigration();
}, []);
```

### 8.3 Manual Testing Checklist

- [ ] Create legacy session with control/reference images
- [ ] Trigger migration
- [ ] Verify unified input_images contains all images
- [ ] Verify image order (control first, then reference)
- [ ] Test generation in Mixboard with migrated session
- [ ] Verify graph view shows correct relationships
- [ ] Test output → input workflow
- [ ] Verify canvas state persistence
- [ ] Test session save/load
- [ ] Verify no data loss during migration

---

## Phase 9: Remove Old Generation View

### 9.1 Deprecation Strategy

**Option A: Dual Mode (Recommended for gradual transition)**
```typescript
// In App.tsx
const [useLegacyView, setUseLegacyView] = useState(false);

// Add toggle in settings
<SettingsModal>
  <label>
    <input
      type="checkbox"
      checked={useLegacyView}
      onChange={(e) => setUseLegacyView(e.target.checked)}
    />
    Use Legacy Generation View
  </label>
</SettingsModal>
```

**Option B: Full Replacement**
- Remove Generation View tab
- Make Mixboard the default and only view
- Update all references

### 9.2 Code Cleanup

**Files to Remove/Update:**
```
Remove:
- components/PromptPanel.tsx (if not reused)
- components/ParametersPanel.tsx (if not reused)
- components/MultiImageUploadPanel.tsx (if not reused)
- components/ResultPanel.tsx (if not reused)

Update:
- App.tsx (remove Generation View routing)
- Navigation (remove Generation View button)
```

### 9.3 Documentation Updates

- Update README.md
- Update user guide
- Add migration guide
- Update API documentation

---

## Implementation Timeline

### Week 1: Foundation
- **Day 1-2:** Phase 1 (Data model analysis and design)
- **Day 3-4:** Phase 2 (Migration utility implementation)
- **Day 5:** Phase 6 (Type definitions update)

### Week 2: Core Features
- **Day 1-3:** Phase 3 (Mixboard history tracking)
- **Day 4-5:** Phase 5 (Output → Input workflow)

### Week 3: Integration
- **Day 1-3:** Phase 4 (Graph view integration)
- **Day 4-5:** Phase 7 (UI updates and history panel)

### Week 4: Testing & Deployment
- **Day 1-2:** Phase 8.1-8.2 (Testing and migration prompt)
- **Day 3:** Phase 8.3 (Manual testing)
- **Day 4:** Bug fixes and refinements
- **Day 5:** Phase 9 (Optional: deprecation/removal)

---

## Risk Assessment

### High Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Backup before migration, test thoroughly, allow rollback |
| Breaking changes to existing sessions | High | Backward compatibility layer, phased rollout |
| Performance issues with large canvases | Medium | Implement virtualization, lazy loading |

### Medium Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| User confusion with new interface | Medium | Clear documentation, migration guide, onboarding tour |
| Graph view performance with large histories | Medium | Pagination, filtering, performance optimization |

### Low Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Styling inconsistencies | Low | Design review, QA testing |
| Edge cases in migration | Low | Comprehensive unit tests, user feedback |

---

## Success Criteria

### Phase 1-2 (Migration)
- ✅ All existing sessions migrate without data loss
- ✅ Images properly unified (control + reference → input)
- ✅ Migration completes in < 5 seconds for 100 sessions

### Phase 3-5 (Features)
- ✅ Generations saved with canvas state
- ✅ Output images can be added to canvas
- ✅ Parent-child relationships tracked correctly

### Phase 6-7 (UI)
- ✅ History panel shows all generations
- ✅ Canvas state can be restored
- ✅ Graph view works with Mixboard sessions

### Phase 8 (Testing)
- ✅ All unit tests pass
- ✅ Manual testing checklist complete
- ✅ No critical bugs in production

### Phase 9 (Cleanup)
- ✅ Old code removed or deprecated
- ✅ Documentation updated
- ✅ User feedback positive

---

## Rollback Plan

### If Migration Fails
1. **Immediate:** Prevent further migrations
2. **Backup:** Restore from pre-migration backup
3. **Logging:** Capture error details for debugging
4. **Communication:** Notify users of temporary rollback

### Rollback Procedure
```typescript
// In migrationService.ts
static rollbackMigration(): void {
  const backup = localStorage.getItem('pre_migration_backup');
  if (backup) {
    localStorage.setItem('sessions', backup);
    localStorage.removeItem('mixboard_migration_completed');
    window.location.reload();
  }
}

// Create backup before migration
static createBackup(): void {
  const sessions = localStorage.getItem('sessions');
  if (sessions) {
    localStorage.setItem('pre_migration_backup', sessions);
  }
}
```

---

## Appendix

### A. Example Migration Flow

```
Legacy Session:
{
  session_id: "s1",
  generations: [{
    generation_id: "g1",
    control_images: [{ id: "c1", filename: "ctrl.png" }],
    reference_images: [{ id: "r1", filename: "ref.png" }],
    output_images: [{ id: "o1", filename: "out.png" }]
  }]
}

↓ Migration ↓

Mixboard Session:
{
  session_id: "s1",
  generations: [{
    generation_id: "g1",
    input_images: [
      { id: "c1", filename: "ctrl.png" },
      { id: "r1", filename: "ref.png" }
    ],
    output_images: [{ id: "o1", filename: "out.png" }],
    canvas_state: undefined,
    parent_generation_ids: []
  }],
  canvas_images: []
}
```

### B. API Changes Summary

**No Breaking Changes:**
- GeminiService.generateImage() signature unchanged
- StorageService continues to work with both formats
- Existing APIs remain backward compatible

**New APIs:**
```typescript
// MigrationService
MigrationService.migrateSession(session)
MigrationService.isLegacySession(session)
MigrationService.migrateAllSessions()

// StorageService additions
StorageService.saveMixboardSession(session)
StorageService.loadMixboardSession(id)
```

### C. Resources

- **Design Mockups:** `/docs/mockups/mixboard-migration/`
- **Test Data:** `/tests/fixtures/legacy-sessions.json`
- **Migration Scripts:** `/scripts/migrate-sessions.ts`

---

**Document Maintenance:**
- Review and update quarterly
- Version bump on major changes
- Keep changelog at end of document

**Last Updated:** 2025-11-29
**Next Review:** 2026-02-28
