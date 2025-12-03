# Canvas Thumbnail System - Implementation Plan

## Overview
Implement a dual-image system where canvas displays lightweight thumbnails for performance while maintaining full-resolution originals for API requests and editing.

## Problem
- Canvas becomes heavy/laggy with many large images (5MB+ each)
- Memory usage high when displaying 10+ images
- Pan/zoom performance degraded

## Solution
- Generate thumbnails (512px max dimension) for canvas display
- Keep original images for API requests
- Right-click context menu to edit images at full resolution
- Expected performance: 90-95% memory reduction, 4-5x faster rendering

---

## Technical Specifications

### Thumbnail Settings
- **Max dimension:** 512px (configurable)
- **Format:** JPEG at 85% quality (PNG if transparent)
- **Generation:** Client-side using Canvas API
- **Expected size reduction:** 90-95%

### Architecture
- **Original images (`dataUri`):** Used for Gemini API requests and editing
- **Thumbnails (`thumbnailUri`):** Displayed on canvas for performance
- **Storage:** Both stored in session/local storage
- **Backward compatibility:** Optional `thumbnailUri` field with fallback

---

## Files to Create/Modify

### 1. **NEW FILE:** `utils/imageUtils.ts`
- Purpose: Thumbnail generation utility
- Function: `generateThumbnail(dataUri, maxDimension, quality)`
- ~80 lines

### 2. **MODIFY:** `types.ts`
- Add `thumbnailUri?: string` to `CanvasImage` interface (line ~189-208)
- ~1 line change

### 3. **MODIFY:** `components/MixboardView.tsx`
- Add context menu state & handlers (~50 lines)
- Add context menu UI (~30 lines)
- Integrate ImageEditModal (~20 lines)
- Update `handleFileUpload` (~10 lines)
- Update `handleDrop` (~5 lines)
- Update canvas rendering (~1 line)
- Update generation result handler (~10 lines)
- Add migration logic (~30 lines)
- Add loading indicator (~10 lines)
- **Total: ~170 lines new/modified**

---

## Implementation Steps

### Step 1: Create Thumbnail Utility ✅
**File:** `utils/imageUtils.ts`

**Function:**
```typescript
export async function generateThumbnail(
  dataUri: string,
  maxDimension: number = 512,
  quality: number = 0.85
): Promise<string>
```

**Features:**
- Load image from data URI
- Calculate new dimensions (maintain aspect ratio)
- Draw to canvas at reduced size
- Use high-quality image smoothing
- Export as JPEG (or PNG if transparent)
- Return thumbnail data URI

---

### Step 2: Update Type Definitions ✅
**File:** `types.ts` (line ~189-208)

**Change:**
```typescript
interface CanvasImage {
  id: string;
  dataUri: string;           // ← Original full-size
  thumbnailUri?: string;     // ← NEW: Thumbnail
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  selected: boolean;
  type?: 'image' | 'text' | 'board';
  // ... other properties
}
```

---

### Step 3: Add Context Menu State ✅
**File:** `components/MixboardView.tsx` (after line 85)

**Add state:**
```typescript
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  imageId: string;
} | null>(null);
const [editModalOpen, setEditModalOpen] = useState(false);
const [editingImage, setEditingImage] = useState<CanvasImage | null>(null);
const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
```

**Add handlers:**
- `handleImageContextMenu(e, imageId)`
- `closeContextMenu()`
- `handleEditImage()`
- `handleDeleteImage()`
- `handleSaveEditedImage(editedDataUri)`

---

### Step 4: Create Context Menu UI ✅
**File:** `components/MixboardView.tsx` (render section)

**Add JSX after canvas container:**
```tsx
{contextMenu && (
  <>
    <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
    <div className="fixed z-50 bg-white dark:bg-zinc-800 ...">
      <button onClick={handleEditImage}>✏️ Edit Image</button>
      <button onClick={handleDeleteImage}>🗑️ Delete</button>
    </div>
  </>
)}
```

---

### Step 5: Wire Up ImageEditModal ✅
**File:** `components/MixboardView.tsx`

**Import:**
```typescript
import { ImageEditModal } from './ImageEditModal';
import { generateThumbnail } from '../utils/imageUtils';
```

**Add to JSX:**
```tsx
<ImageEditModal
  isOpen={editModalOpen}
  image={editingImage?.dataUri || null}
  onClose={() => { setEditModalOpen(false); setEditingImage(null); }}
  onSave={handleSaveEditedImage}
/>
```

**Update image div to support context menu (line ~1067):**
```tsx
onContextMenu={(e) => handleImageContextMenu(e, image.id)}
```

---

### Step 6: Update Upload Handlers ✅
**File:** `components/MixboardView.tsx`

**A. handleFileUpload (lines 503-534):**
- Add `setIsGeneratingThumbnails(true)` at start
- After loading `dataUri`, call `await generateThumbnail(dataUri)`
- Add `thumbnailUri` to `CanvasImage` object
- Add `setIsGeneratingThumbnails(false)` in finally block

**B. handleDrop (lines 537-579):**
- Inside image processing loop
- After loading `dataUri`, call `await generateThumbnail(dataUri)`
- Add `thumbnailUri` to `CanvasImage` object

---

### Step 7: Update Canvas Rendering ✅
**File:** `components/MixboardView.tsx` (line ~1104)

**Change:**
```tsx
<img
  src={image.thumbnailUri || image.dataUri}
  alt="Canvas item"
  className="w-full h-full object-cover pointer-events-none"
/>
```

---

### Step 8: Update Generation Result Handler ✅
**File:** `components/MixboardView.tsx` (around line 310-340)

**Inside `handleGenerateMixboard` where output images are added:**
- After converting API response to `dataUri`
- Generate thumbnail: `await generateThumbnail(dataUri)`
- Add both `dataUri` and `thumbnailUri` to `CanvasImage`

---

### Step 9: Add Migration Logic ✅
**File:** `components/MixboardView.tsx`

**Add useEffect:**
```typescript
useEffect(() => {
  const migrateImages = async () => {
    const needsMigration = canvasImages.some(img => !img.thumbnailUri && img.dataUri);
    if (needsMigration) {
      const migratedImages = await Promise.all(
        canvasImages.map(async (img) => {
          if (!img.thumbnailUri && img.dataUri) {
            const thumbnailUri = await generateThumbnail(img.dataUri);
            return { ...img, thumbnailUri };
          }
          return img;
        })
      );
      setCanvasImages(migratedImages);
    }
  };
  migrateImages();
}, [currentSession?.id]);
```

---

### Step 10: Add Loading Indicator ✅
**File:** `components/MixboardView.tsx`

**Add to JSX:**
```tsx
{isGeneratingThumbnails && (
  <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
    Generating thumbnails...
  </div>
)}
```

---

## User Experience Flow

1. **Upload large images** → Auto-generates thumbnails with loading indicator
2. **Canvas displays lightweight thumbnails** → Smooth panning/zooming
3. **Right-click any image** → Context menu appears
4. **Click "Edit Image"** → ImageEditModal opens with full-resolution original
5. **Draw/edit at full quality** → Save updates both original and thumbnail
6. **Canvas updates** → New thumbnail displayed, original preserved for API

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Memory per image | ~5-10 MB | ~100-300 KB | 95-97% reduction |
| Canvas FPS (20 images) | 10-15 fps | 50-60 fps | 4-5x faster |
| Pan/zoom smoothness | Laggy | Smooth | ✅ |
| Initial load time | 3-5s | 0.5-1s | 5-10x faster |
| Edit quality | Full | Full | No change |
| API request quality | Full | Full | No change |

---

## Testing Checklist

After implementation, verify:
- ✅ Upload 10+ large images (5MB+ each) to canvas
- ✅ Verify smooth panning and zooming
- ✅ Right-click image → Context menu appears
- ✅ Edit image → Modal opens with full resolution
- ✅ Draw on image → Save → Changes persist
- ✅ Generate image using canvas image as reference → Verify full quality sent
- ✅ Check output quality matches original
- ✅ Save session → Close → Reload → Images persist
- ✅ Load old session without thumbnails → Migration works
- ✅ Memory usage monitoring (Task Manager)
- ✅ Drag-drop from gallery still works

---

## Risks & Mitigation

**Risk 1: Thumbnail generation slow for large images**
- ✅ Mitigation: Show loading indicator, generate asynchronously
- Expected: <100ms per image on modern hardware

**Risk 2: Existing sessions break**
- ✅ Mitigation: Optional `thumbnailUri` field + fallback logic
- ✅ Migration generates thumbnails on-demand

**Risk 3: Quality loss perceived by users**
- ✅ Mitigation: 512px is high enough for canvas display
- ✅ Original preserved for generation and editing

---

## Platform Notes

- **Target:** Electron desktop app on Windows
- **No web compatibility needed:** Can use full Canvas API features
- **Storage:** Electron localStorage and file system
- **No network concerns:** All processing client-side

---

## Backward Compatibility

- ✅ `thumbnailUri` is optional field
- ✅ Canvas rendering falls back to `dataUri` if no thumbnail
- ✅ Old sessions auto-migrate on first load
- ✅ No breaking changes to existing functionality

---

## Implementation Order

1. Create `utils/imageUtils.ts` with thumbnail generator
2. Update `types.ts` with new field
3. Add context menu to `MixboardView.tsx`
4. Wire up `ImageEditModal` integration
5. Update all image upload/generation handlers
6. Update canvas rendering
7. Add migration logic
8. Add loading indicator
9. Test thoroughly

---

## Git Workflow

- Branch: `claude/canvas-image-thumbnails-01JScDGi1SYvEKC7JtboFLAy`
- Commit after each major step
- Push when all tests pass
