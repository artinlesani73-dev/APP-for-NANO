# API Request Examples

These examples show how Mixboard sends requests to the Gemini API when generating **images** or **text**. Base64 payloads are abbreviated for clarity.

## Image generation with selected canvas images
```json
{
  "model": "gemini-2.5-flash-image",
  "contents": {
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAA..." // first selected canvas image
        }
      },
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoBBB..." // second selected canvas image
        }
      },
      {
        "text": "Context images: reference images (parts 1-2). Analyse the content of context images and respond to the requests.\n\nGenerate a surreal landscape in watercolor style."
      }
    ]
  },
  "config": {
    "imageConfig": {
      "aspectRatio": "1:1"
    }
  },
  "requestOptions": {
    "headers": {
      "X-User-Name": "<display-name>"
    }
  }
}
```

## Text generation with selected canvas images
```json
{
  "model": "gemini-2.0-flash-exp",
  "contents": {
    "parts": [
      {
        "inlineData": {
          "mimeType": "image/png",
          "data": "iVBORw0KGgoAAA..." // selected canvas image
        }
      },
      {
        "text": "Context images provided (parts 1-1). Analyse the content of context images and respond to the requests.\n\nWrite a product description.\n\n(Generate a concise response in 150 words or less)"
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
      "X-User-Name": "<display-name>"
    }
  }
}
```
