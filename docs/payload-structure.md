# Structured image-generation payload example

The request sent to the Gemini API keeps control and reference images separate and annotates their order in the prompt preamble. Control images are listed first, followed by reference images, and the trailing text part contains the structured prompt.

## Example payload with 2 control images and 3 reference images
```json
{
  "model": "gemini-2.5-flash-image",
  "contents": {
    "parts": [
      { "inlineData": { "mimeType": "image/png", "data": "<control-1-base64>" } },
      { "inlineData": { "mimeType": "image/png", "data": "<control-2-base64>" } },
      { "inlineData": { "mimeType": "image/png", "data": "<reference-1-base64>" } },
      { "inlineData": { "mimeType": "image/png", "data": "<reference-2-base64>" } },
      { "inlineData": { "mimeType": "image/png", "data": "<reference-3-base64>" } },
      {
        "text": "Context images: control images (parts 1-2) for structure/composition; reference images (parts 3-5) for style. Preserve order across both groups.\n\nCreate a cozy living room scene in watercolor."
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
      "X-User-Name": "alice"
    }
  }
}
```

- Replace `data` values with base64 strings **without** the `data:image/png;base64,` prefix.
- When using `gemini-3-pro-image-preview`, include an `"imageSize": "<width>x<height>"` property under `config.imageConfig`.
- If no user name is needed, omit `requestOptions` entirely.
