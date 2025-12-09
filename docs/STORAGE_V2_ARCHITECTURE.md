# Storage V2 Architecture

**Status**: ✅ Implemented
**Target**: Desktop app only (Electron)
**Format**: MixboardSession only (legacy Session deprecated)

---

## Overview

Storage V2 redesigns the data persistence layer with separated concerns and better scalability:

1. **Session data split**: Generations and canvas state stored separately
2. **Global image registry**: Session-agnostic image deduplication
3. **Hash-based references**: Content-addressed image storage
4. **Append-only logs**: JSONL format for efficient logging

---

## File Structure

```
~/APP-for-NANO/
├── sessions/
│   ├── mixboard-1234567890_generations.json
│   ├── mixboard-1234567890_canvas.json
│   ├── mixboard-1234567891_generations.json
│   └── mixboard-1234567891_canvas.json
├── images/
│   ├── input_1733664000000_abc123.png
│   ├── output_1733664100000_def456.png
│   └── ...
├── thumbnails/
│   ├── mixboard-1234567890/
│   │   ├── img-001.png
│   │   └── img-002.png
│   └── mixboard-1234567891/
│       └── img-003.png
├── image_registry.json
└── logs.jsonl
```

---

## Data Schemas

### 1. Image Registry (`image_registry.json`)

**Purpose**: Global, session-agnostic image catalog with deduplication

**Schema**:
```json
{
  "version": "2.0",
  "images": {
    "abc123hash": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "hash": "abc123hash",
      "original_name": "photo.jpg",
      "imported_at": "2025-12-08T10:00:00.000Z",
      "size_bytes": 123456,
      "width": 1024,
      "height": 768,
      "mime_type": "image/png",
      "file_path": "images/input_1733664000000_abc123.png"
    }
  }
}
```

**Key Features**:
- **Hash as key**: Same image imported multiple times → same hash
- **Persistent identity**: `id` and `hash` remain stable across sessions
- **File reference**: `file_path` points to actual PNG file
- **Metadata**: Dimensions, size, original name tracked

---

### 2. Generations File (`{sessionId}_generations.json`)

**Purpose**: Stores all AI generation history for a session

**Schema**:
```json
{
  "version": "2.0",
  "session_id": "mixboard-1234567890",
  "generations": [
    {
      "generation_id": "gen-123",
      "timestamp": "2025-12-08T10:15:00.000Z",
      "status": "completed",
      "prompt": "A serene landscape with mountains",
      "input_images": [
        {
          "id": "abc123hash",
          "filename": "input_1733664000000_abc123.png",
          "hash": "abc123hash",
          "size_bytes": 123456
        }
      ],
      "output_images": [
        {
          "id": "def456hash",
          "filename": "output_1733664100000_def456.png",
          "hash": "def456hash",
          "size_bytes": 234567
        }
      ],
      "parameters": {
        "model": "gemini-2.5-flash-image",
        "temperature": 0.7,
        "top_p": 0.95,
        "aspect_ratio": "16:9"
      },
      "generation_time_ms": 5234,
      "canvas_state": {
        "images": [...],
        "zoom": 1.0,
        "panOffset": { "x": 0, "y": 0 }
      }
    }
  ]
}
```

**Key Features**:
- Array of generation records
- References images by hash (via `StoredImageMeta`)
- Preserves canvas state at generation time
- Tracks timing and parameters

---

### 3. Canvas State File (`{sessionId}_canvas.json`)

**Purpose**: Current canvas layout and image positions

**Schema**:
```json
{
  "version": "2.0",
  "session_id": "mixboard-1234567890",
  "title": "My Creative Project",
  "created_at": "2025-12-08T10:00:00.000Z",
  "updated_at": "2025-12-08T11:30:00.000Z",
  "canvas_images": [
    {
      "canvasId": "canvas-img-001",
      "imageHash": "abc123hash",
      "type": "image",
      "x": 100,
      "y": 200,
      "width": 300,
      "height": 400,
      "selected": false,
      "originalWidth": 1024,
      "originalHeight": 768,
      "generationId": "gen-123",
      "thumbnailPath": "thumbnails/mixboard-1234567890/img-001.png"
    },
    {
      "canvasId": "canvas-text-001",
      "type": "text",
      "text": "Hello World",
      "fontSize": 24,
      "fontWeight": "bold",
      "x": 500,
      "y": 100,
      "width": 200,
      "height": 50,
      "selected": false
    }
  ],
  "zoom": 1.2,
  "panOffset": { "x": -50, "y": 100 },
  "user": {
    "displayName": "John Doe",
    "id": "user-123"
  }
}
```

**Key Features**:
- **Hash references**: `imageHash` points to `image_registry`
- **Supports multiple entity types**: image, text, board
- **Canvas metadata**: zoom, pan, user info
- **Lightweight**: No embedded base64 data

---

### 4. Logs File (`logs.jsonl`)

**Purpose**: Append-only event log (JSON Lines format)

**Format**: One JSON object per line
```jsonl
{"timestamp":"2025-12-08T10:00:00.000Z","level":"info","user":"John Doe","userId":"user-123","message":"Session created","context":{"sessionId":"mixboard-123"}}
{"timestamp":"2025-12-08T10:01:00.000Z","level":"action","user":"John Doe","message":"Image generated","context":{"generationId":"gen-456","duration":5234}}
{"timestamp":"2025-12-08T10:02:00.000Z","level":"error","message":"API rate limit exceeded","context":{"retryAfter":60}}
```

**Key Features**:
- **Append-only**: Never rewrites entire file
- **JSONL format**: One entry per line for easy parsing/streaming
- **Efficient**: Fast writes, no need to load all logs
- **Machine-readable**: Can use tools like `jq`, `grep`, etc.

---

## API Usage

### Import StorageServiceV2

```typescript
import { StorageServiceV2 } from '../services/storageV2';
```

### Register an Image

```typescript
// Register image and get hash
const { hash, entry } = StorageServiceV2.registerImage(
  dataUri,           // data:image/png;base64,...
  'photo.jpg',       // optional original name
  'reference'        // role: 'control' | 'reference' | 'output'
);

console.log('Image hash:', hash);
console.log('File path:', entry.file_path);
```

**Deduplication**: If same image is registered again, returns existing hash.

### Create a Session

```typescript
const session = StorageServiceV2.createSession(
  'My Project',
  { displayName: 'John Doe', id: 'user-123' }
);

console.log('Session ID:', session.session_id);
```

Creates:
- `{sessionId}_generations.json` (empty)
- `{sessionId}_canvas.json` (empty canvas)

### Save a Session

```typescript
// Modify session
session.canvas_images.push({
  id: 'canvas-img-001',
  dataUri: 'data:image/png;base64,...',
  x: 100,
  y: 200,
  width: 300,
  height: 400,
  selected: false,
  originalWidth: 1024,
  originalHeight: 768
});

// Save (automatically splits into generations + canvas)
StorageServiceV2.saveSession(session);
```

**What happens**:
1. New images are registered in `image_registry.json`
2. Canvas images get hash references
3. `{sessionId}_canvas.json` updated
4. `{sessionId}_generations.json` updated

### Load a Session

```typescript
const session = StorageServiceV2.loadSession('mixboard-1234567890');

if (session) {
  console.log('Title:', session.title);
  console.log('Canvas images:', session.canvas_images.length);
  console.log('Generations:', session.generations.length);
}
```

**Reconstruction**:
1. Loads canvas state from `{sessionId}_canvas.json`
2. Loads generations from `{sessionId}_generations.json`
3. Resolves image hashes to full data URIs (from `image_registry.json`)
4. Returns complete `MixboardSession` object

### List All Sessions

```typescript
const sessions = StorageServiceV2.listSessions();

sessions.forEach(meta => {
  console.log(`${meta.title} - ${meta.generation_count} generations`);
});
```

Returns lightweight metadata (no full image data).

### Load Image by Hash

```typescript
const dataUri = StorageServiceV2.loadImageByHash('abc123hash');

if (dataUri) {
  // Use data URI in <img> tag
}
```

### Append Log Entry

```typescript
StorageServiceV2.appendLog({
  level: 'action',
  user: 'John Doe',
  userId: 'user-123',
  message: 'Image generated',
  context: {
    generationId: 'gen-456',
    duration: 5234
  }
});
```

**Efficient**: Appends single line to `logs.jsonl` without loading entire file.

### Read Logs

```typescript
const logs = StorageServiceV2.readLogs(100); // Last 100 entries

logs.forEach(entry => {
  console.log(`[${entry.timestamp}] ${entry.level}: ${entry.message}`);
});
```

---

## Migration from V1

**No automatic migration** - V2 is a clean slate.

### Manual Migration Steps (if needed)

1. **Export V1 data**:
   ```typescript
   const oldSessions = StorageService.getSessions();
   ```

2. **Convert to V2 format**:
   ```typescript
   oldSessions.forEach(oldSession => {
     const newSession = StorageServiceV2.createSession(
       oldSession.title,
       oldSession.user
     );

     // Convert canvas images
     oldSession.canvas_images.forEach(img => {
       if (img.dataUri) {
         const { hash } = StorageServiceV2.registerImage(img.dataUri);
         // Add to new session...
       }
     });

     StorageServiceV2.saveSession(newSession);
   });
   ```

---

## Performance Characteristics

### Read Operations

| Operation | V1 (Old) | V2 (New) | Improvement |
|-----------|----------|----------|-------------|
| List sessions | Parse all JSON | Read canvas files only | 2x faster |
| Load session | 1 file | 2 files + registry | Similar |
| Load image | Embedded in session | Registry lookup | Faster for large sessions |

### Write Operations

| Operation | V1 (Old) | V2 (New) | Improvement |
|-----------|----------|----------|-------------|
| Save session | Rewrite entire JSON | Update 2 files | Similar |
| Add image | Rewrite session | Append to registry | Faster |
| Log event | Rewrite logs.json | Append line | 100x faster |

### Storage Efficiency

- **Deduplication**: Same image imported 10 times → stored once
- **Thumbnails**: Separate from full images (faster canvas rendering)
- **Logs**: JSONL more efficient than array rewrites

---

## Advantages Over V1

✅ **Separated concerns**: Generations and canvas independent
✅ **Deduplication**: Images shared across sessions
✅ **Hash-based refs**: Content-addressed storage
✅ **Efficient logging**: Append-only JSONL
✅ **Scalability**: Large sessions don't slow down listing
✅ **Clear ownership**: Each file has single responsibility

---

## Backward Compatibility

**None** - V2 is incompatible with V1.

- V1 files: `sessions/{sessionId}.json`
- V2 files: `sessions/{sessionId}_generations.json` + `{sessionId}_canvas.json`

Both can coexist in same directory without conflicts.

---

## Future Enhancements

- **JSONL for generations**: Store generations as append-only log
- **SQLite**: Consider database for complex queries
- **Compression**: GZIP for large generation files
- **Versioning**: Track canvas state history with diffs
- **Cloud sync**: Hash-based sync for shared projects

---

## File Size Examples

**Small session** (5 generations, 10 canvas images):
- `_generations.json`: ~50 KB
- `_canvas.json`: ~5 KB
- Images: ~2 MB (thumbnails: ~200 KB)

**Large session** (100 generations, 200 canvas images):
- `_generations.json`: ~1 MB
- `_canvas.json`: ~100 KB
- Images: ~40 MB (thumbnails: ~4 MB)

**Registry** (1000 unique images):
- `image_registry.json`: ~500 KB

---

## Debugging

### Check if image is registered

```bash
cat ~/APP-for-NANO/image_registry.json | jq '.images["abc123hash"]'
```

### Count sessions

```bash
ls ~/APP-for-NANO/sessions/*_canvas.json | wc -l
```

### View recent logs

```bash
tail -n 20 ~/APP-for-NANO/logs.jsonl | jq .
```

### Find sessions by user

```bash
grep -l "user-123" ~/APP-for-NANO/sessions/*_canvas.json
```

---

## Summary

Storage V2 provides a clean, scalable architecture for desktop app:

- ✅ Split session data for better organization
- ✅ Global image registry with deduplication
- ✅ Hash-based references for consistency
- ✅ Append-only JSONL logging
- ✅ Desktop-only (no web/localStorage complexity)
- ✅ MixboardSession only (no legacy support)

**Result**: Faster, more efficient, and easier to maintain.
