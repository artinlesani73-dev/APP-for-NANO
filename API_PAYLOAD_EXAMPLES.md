# API Payload Examples

This document provides examples of all payloads sent from the APP-for-NANO application to external API servers.

## Table of Contents

1. [Google Gemini API](#google-gemini-api)
   - [Image Generation](#1-image-generation)
   - [Text Generation](#2-text-generation)
2. [Logging API](#logging-api)
3. [Configuration](#configuration)

---

## Google Gemini API

The application uses the `@google/genai` SDK to communicate with Google's Gemini API.

**Base URL**: Managed by the SDK (https://generativelanguage.googleapis.com)

**Authentication**: API Key (sent via SDK configuration)

**Code Location**: `services/geminiService.ts`

---

### 1. Image Generation

**Endpoint**: POST to Gemini API (via SDK)

**Used For**: Generating images from text prompts with optional control and reference images

**Code Location**:
- `services/geminiService.ts:50-202`
- Called from `App.tsx:654-660` and `components/MixboardView.tsx:607-613`

#### Case 1.1: Basic Image Generation (Prompt Only)

```json
{
  "model": "gemini-2.5-flash-image",
  "contents": {
    "parts": [
      {
        "text": "A serene landscape with mountains and a lake at sunset"
      }
    ]
  },
  "config": {
    "imageConfig": {
      "aspectRatio": "1:1"
    }
  }
}
```

#### Case 1.2: Image Generation with Reference Images

```json
{
  "model": "gemini-2.5-flash-image",
  "contents": {
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "Create an image in the style of these reference images"
      }
    ]
  },
  "config": {
    "imageConfig": {
      "aspectRatio": "16:9"
    }
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "John Doe"
    }
  }
}
```

#### Case 1.3: Image Generation with Control Images

```json
{
  "model": "gemini-2.5-flash-image",
  "contents": {
    "parts": [
      {
        "text": "Control image 1"
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "Generate a photorealistic portrait"
      }
    ]
  },
  "config": {
    "imageConfig": {
      "aspectRatio": "9:16"
    }
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "Jane Smith"
    }
  }
}
```

#### Case 1.4: Image Generation with All Options (Pro Model)

```json
{
  "model": "gemini-3-pro-image-preview",
  "contents": {
    "parts": [
      {
        "text": "Control image 1"
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "Reference image 1"
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "Reference image 2"
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "A futuristic city with flying cars, dramatic lighting, highly detailed"
      }
    ]
  },
  "config": {
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "2K"
    }
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "Alex Johnson"
    }
  }
}
```

#### Configuration Parameters

The generation config affects the API payload:

```typescript
{
  "temperature": 0.7,        // Creativity level (0.0-2.0)
  "top_p": 0.95,            // Nucleus sampling (0.0-1.0)
  "aspect_ratio": "1:1",    // Options: "1:1", "16:9", "9:16", "4:3", "3:4"
  "image_size": "1K",       // Options: "1K", "2K" (Pro model only)
  "safety_filter": "medium", // Content filtering level
  "model": "gemini-2.5-flash-image" // or "gemini-3-pro-image-preview"
}
```

#### Response Format

```json
{
  "images": [
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  ],
  "texts": []
}
```

---

### 2. Text Generation

**Endpoint**: POST to Gemini API (via SDK)

**Used For**: Generating text descriptions from images and prompts

**Code Location**:
- `services/geminiService.ts:204-295`
- Called from `components/MixboardView.tsx:737-743`

#### Case 2.1: Text Generation with Reference Images

```json
{
  "model": "gemini-2.0-flash-exp",
  "contents": {
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        }
      },
      {
        "text": "Describe the scene in these images. Note: Some images may be AI-generated or styled reference images."
      }
    ]
  },
  "config": {
    "maxOutputTokens": 225,
    "temperature": 0.7,
    "topP": 0.95
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "John Doe"
    }
  }
}
```

#### Case 2.2: Text Generation (Prompt Only, No Images)

```json
{
  "model": "gemini-2.0-flash-exp",
  "contents": {
    "parts": [
      {
        "text": "Write a short description of a cyberpunk cityscape. Note: Some images may be AI-generated or styled reference images."
      }
    ]
  },
  "config": {
    "maxOutputTokens": 225,
    "temperature": 0.7,
    "topP": 0.95
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "Jane Smith"
    }
  }
}
```

#### Response Format

```json
{
  "text": "The cyberpunk cityscape is a neon-lit dystopia with towering skyscrapers, flying vehicles, and holographic advertisements illuminating the perpetual night. Rain-slicked streets reflect the vibrant colors..."
}
```

**Note**: The response text is automatically trimmed to approximately 150 words.

---

## Logging API

**Endpoint**: POST to custom logging endpoint (configurable)

**Used For**: Tracking user actions, errors, and events

**Code Location**: `services/logger.ts:116-131`

**Configuration**: Set via `VITE_LOG_ENDPOINT` environment variable or `metadata.json`

**Batch Behavior**: Logs are buffered and sent every 5 seconds in batches

### Case 3.1: User Login Event

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-08T10:30:00.000Z",
    "user": "John Doe",
    "userId": "user-12345",
    "type": "login",
    "message": "User logged in",
    "context": {}
  }
]
```

### Case 3.2: Generation Started Event

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2025-12-08T10:32:15.234Z",
    "user": "John Doe",
    "userId": "user-12345",
    "type": "action",
    "message": "Generation started",
    "context": {
      "sessionId": "session-abc123",
      "model": "gemini-2.5-flash-image",
      "promptLength": 45,
      "hasControlImages": false,
      "hasReferenceImages": true,
      "aspectRatio": "16:9"
    }
  }
]
```

### Case 3.3: Generation Completed Event

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "timestamp": "2025-12-08T10:32:20.567Z",
    "user": "John Doe",
    "userId": "user-12345",
    "type": "action",
    "message": "Generation completed",
    "context": {
      "sessionId": "session-abc123",
      "generationId": "gen-xyz789",
      "durationMs": 5333,
      "outputCount": 4
    }
  }
]
```

### Case 3.4: Error Event

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "timestamp": "2025-12-08T10:35:42.891Z",
    "user": "Jane Smith",
    "userId": "user-67890",
    "type": "error",
    "message": "Generation failed",
    "context": {
      "error": "API rate limit exceeded",
      "errorCode": "RATE_LIMIT_EXCEEDED",
      "sessionId": "session-def456",
      "retryAfter": 60
    }
  }
]
```

### Case 3.5: Batch of Multiple Events

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "timestamp": "2025-12-08T10:40:00.000Z",
    "user": "Alice Cooper",
    "type": "action",
    "message": "Canvas image added",
    "context": {
      "sessionId": "session-ghi789",
      "canvasId": "canvas-001",
      "imageSource": "upload"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "timestamp": "2025-12-08T10:40:05.123Z",
    "user": "Alice Cooper",
    "type": "action",
    "message": "Canvas image transformed",
    "context": {
      "sessionId": "session-ghi789",
      "canvasId": "canvas-001",
      "imageId": "img-123",
      "transformation": "scale"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440006",
    "timestamp": "2025-12-08T10:40:08.456Z",
    "user": "Alice Cooper",
    "type": "action",
    "message": "Session saved",
    "context": {
      "sessionId": "session-ghi789",
      "title": "My Creative Project"
    }
  }
]
```

### Case 3.6: Anonymous User Event

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440007",
    "timestamp": "2025-12-08T10:45:00.000Z",
    "user": "anonymous",
    "type": "action",
    "message": "Generation started",
    "context": {
      "sessionId": "session-jkl012",
      "model": "gemini-2.5-flash-image"
    }
  }
]
```

### Log Entry Schema

```typescript
{
  "id": string;              // UUID v4
  "timestamp": string;       // ISO 8601 format
  "user": string;            // Display name or "anonymous"
  "userId"?: string;         // Optional user identifier
  "type": "login" | "action" | "error";
  "message": string;         // Human-readable event description
  "context"?: {              // Optional additional metadata
    [key: string]: any;
  }
}
```

---

## Configuration

### API Key Sources

The application retrieves API keys in the following priority order:

1. **Electron Desktop**: `localStorage.getItem('gemini_api_key')`
2. **AI Studio Environment**: `window.aistudio.hasSelectedApiKey()`
3. **Shared API Key**: From environment or metadata
4. **Environment Variables**: `VITE_SHARED_API_KEY` or `API_KEY`

### Environment Variables

```bash
# Required for Gemini API access
VITE_SHARED_API_KEY=your-gemini-api-key-here
GEMINI_API_KEY=your-gemini-api-key-here

# Optional logging endpoint
VITE_LOG_ENDPOINT=https://your-logging-server.com/api/logs

# Optional admin features
VITE_ADMIN_PASSPHRASE=your-admin-passphrase
```

### Metadata Configuration

The app can also be configured via `metadata.json`:

```json
{
  "sharedApiKey": "your-gemini-api-key-here",
  "logEndpoint": "https://your-logging-server.com/api/logs",
  "environment": "production"
}
```

---

## Request Headers

### Gemini API Requests

```
Content-Type: application/json
X-User-Name: John Doe
```

The `X-User-Name` header is optional and only included when a user is logged in.

### Logging API Requests

```
Content-Type: application/json
```

---

## Error Handling

### Gemini API Errors

When the Gemini API returns an error, it's caught and logged:

```typescript
try {
  const output = await GeminiService.generateImage(...);
} catch (error) {
  // Error logged to console and logging service
  console.error('[GeminiService] Error:', error);

  // Stored in generation record
  StorageService.completeGeneration(
    sessionId,
    generationId,
    [],
    duration,
    [],
    'API_ERROR',
    error.message
  );
}
```

### Logging API Errors

Failed log submissions are re-queued and retried on the next flush interval (5 seconds).

```json
{
  "error": "Network request failed",
  "retriedCount": 3,
  "nextRetry": "2025-12-08T10:50:00.000Z"
}
```

---

## Rate Limiting

The application does not implement client-side rate limiting. Rate limits are enforced by the Gemini API:

- **Free tier**: ~60 requests per minute
- **Paid tier**: Higher limits based on billing plan

When rate limited, the API returns an error that is caught and displayed to the user.

---

## Data Privacy

- **Images**: Base64-encoded and sent directly in API requests (not stored on external servers)
- **User Names**: Only display names are sent (no email or sensitive data)
- **API Keys**: Stored locally (localStorage or Electron secure storage)
- **Sessions**: Stored locally only (no cloud sync unless logging endpoint is configured)

---

## Summary

| API | Endpoint Type | Frequency | Authentication | Purpose |
|-----|--------------|-----------|----------------|---------|
| Google Gemini (Image) | POST | On-demand | API Key | Generate images from prompts |
| Google Gemini (Text) | POST | On-demand | API Key | Generate text from prompts/images |
| Custom Logging | POST | Every 5s (batched) | None | Event tracking and analytics |

**Total External API Calls**: 2 services (Gemini API + optional logging)

**IPC Communication**: Electron IPC for local file operations (not HTTP)
