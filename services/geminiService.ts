import { GoogleGenAI, Part } from "@google/genai";
import { GenerationConfig } from "../types";
import { AppConfig } from "./config";

// Helper to remove data URL prefix for API
// Defensive implementation that handles edge cases
const stripBase64Header = (dataUrl: string): string => {
  // Handle null/undefined/empty
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Invalid image data: expected non-empty string');
  }

  // Trim whitespace
  const trimmed = dataUrl.trim();

  // Try multiple approaches to strip the data URI prefix
  // 1. Standard format: data:image/png;base64,xxxxx (case-insensitive)
  // 2. With charset: data:image/png;charset=utf-8;base64,xxxxx
  // 3. Other variations

  // More flexible regex - case insensitive, handles various MIME subtypes and optional params
  const dataUriPattern = /^data:image\/[^;,]+(?:;[^;,]*)*;base64,/i;
  let stripped = trimmed.replace(dataUriPattern, '');

  // If first pattern didn't match, try simpler pattern
  if (stripped === trimmed) {
    // Try to find base64, marker and take everything after it
    const base64Marker = ';base64,';
    const markerIndex = trimmed.toLowerCase().indexOf(base64Marker);
    if (markerIndex !== -1) {
      stripped = trimmed.substring(markerIndex + base64Marker.length);
    }
  }

  // If still no change, check if it might already be raw base64
  if (stripped === trimmed) {
    // Validate it looks like base64 (starts with valid base64 char)
    if (!/^[A-Za-z0-9+/]/.test(trimmed)) {
      console.error('[GeminiService] Invalid image data format. First 100 chars:', trimmed.substring(0, 100));
      throw new Error('Invalid image data: not a valid data URL or base64 string');
    }
    // Already raw base64
    return trimmed;
  }

  // Validate the stripped result isn't empty
  if (!stripped || stripped.trim() === '') {
    console.error('[GeminiService] Empty base64 after stripping. Original first 100 chars:', trimmed.substring(0, 100));
    throw new Error('Invalid image data: base64 content is empty after stripping header');
  }

  return stripped;
};

const isElectron = () => {
  // @ts-ignore
  return window.electron !== undefined;
};

export const GeminiService = {
  checkApiKey: async () => {
    // In Electron, check localStorage for API key
    if (isElectron()) {
      const apiKey = localStorage.getItem('gemini_api_key');
      return !!apiKey && apiKey.trim().length > 0;
    }

    // In AI Studio environment, use the aistudio API
    // @ts-ignore - aistudio is injected by the environment
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        return await window.aistudio.hasSelectedApiKey();
    }

    // Otherwise fall back to shared configuration
    const sharedKey = AppConfig.getSharedApiKey();
    return !!sharedKey;
  },

  requestApiKey: async () => {
      // In Electron, user should go to Settings to enter API key
      if (isElectron()) {
        alert('Please go to Settings (gear icon) to enter your Google AI API key.\n\nGet your key from: https://aistudio.google.com/app/apikey');
        return;
      }

      // In AI Studio environment, use the aistudio API
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
      }
  },

  generateImage: async (
    prompt: string,
    config: GenerationConfig,
    controlImageBase64?: string[] | string,
    referenceImageBase64?: string[] | string,
    contextImageBase64?: string[] | string,
    userName?: string
  ): Promise<{ images: string[]; texts: string[] }> => {

    // Get API key based on environment
    let apiKey: string | undefined;

    if (isElectron()) {
      // In Electron, get from localStorage
      const storedKey = localStorage.getItem('gemini_api_key');
      if (!storedKey || !storedKey.trim()) {
        throw new Error("API Key not configured. Please go to Settings to enter your Google AI API key.");
      }
      apiKey = storedKey.trim();
    } else {
      // In AI Studio environment, check if key is selected
      if (config.model === 'gemini-3-pro-image-preview') {
        // @ts-ignore
        const hasKey = await window.aistudio?.hasSelectedApiKey();
        if (!hasKey) {
          throw new Error("API Key not selected. Please connect to Google AI Studio to use the Pro model.");
        }
      }
      apiKey = AppConfig.getSharedApiKey();
      if (!apiKey) {
        throw new Error("Shared API key not configured. Please add VITE_SHARED_API_KEY or metadata.sharedApiKey.");
      }
    }

    // Create AI instance with the API key
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: Part[] = [];
    
    const controlImages = controlImageBase64
      ? Array.isArray(controlImageBase64)
        ? controlImageBase64
        : [controlImageBase64]
      : [];

    const referenceImages = referenceImageBase64
      ? Array.isArray(referenceImageBase64)
        ? referenceImageBase64
        : [referenceImageBase64]
      : [];

    const contextImages = contextImageBase64
      ? Array.isArray(contextImageBase64)
        ? contextImageBase64
        : [contextImageBase64]
      : [];

    // Add images to parts if they exist
    // Note: Gemini 'generateContent' takes context images.
    // We treat Control/Reference as multimodal inputs.
    controlImages.forEach((image, idx) => {
      try {
        const base64Data = stripBase64Header(image);
        parts.push({
          inlineData: {
            mimeType: 'image/png', // Assuming PNG for simplicity in this demo, actual app would preserve mime
            data: base64Data
          }
        });
      } catch (err) {
        console.error(`[GeminiService] Invalid control image at index ${idx}:`, err);
        throw new Error(`Control image ${idx + 1} is invalid: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    });

    referenceImages.forEach((image, idx) => {
      try {
        const base64Data = stripBase64Header(image);
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data
          }
        });
      } catch (err) {
        console.error(`[GeminiService] Invalid reference image at index ${idx}:`, err);
        throw new Error(`Reference image ${idx + 1} is invalid: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    });

    contextImages.forEach((image, idx) => {
      try {
        const base64Data = stripBase64Header(image);
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data
          }
        });
      } catch (err) {
        console.error(`[GeminiService] Invalid context image at index ${idx}:`, err);
        throw new Error(`Context image ${idx + 1} is invalid: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    });

    // Add a structured preamble so the model knows how many and which images are controls vs references.
    // We describe the order and role of each slice of parts with specific guidance for each type.
    let finalPrompt = prompt;
    const hasControls = controlImages.length > 0;
    const hasReferences = referenceImages.length > 0;
    const hasContext = contextImages.length > 0;

    if (hasControls || hasReferences || hasContext) {
      const preambleParts: string[] = [];
      let partIndex = 1;

      // Control images: structure, geometry, composition
      if (hasControls) {
        const controlEnd = partIndex + controlImages.length - 1;
        const controlRange = controlImages.length === 1
          ? `part ${partIndex}`
          : `parts ${partIndex}-${controlEnd}`;
        preambleParts.push(
          `CONTROL IMAGE${controlImages.length === 1 ? '' : 'S'} (${controlRange}): ` +
          `Analyze these for structure, geometry, composition, layout, and spatial arrangement. ` +
          `Use these as the structural foundation for the generated image.`
        );
        partIndex = controlEnd + 1;
      }

      // Reference images: style, materials, mood
      if (hasReferences) {
        const refEnd = partIndex + referenceImages.length - 1;
        const refRange = referenceImages.length === 1
          ? `part ${partIndex}`
          : `parts ${partIndex}-${refEnd}`;
        preambleParts.push(
          `REFERENCE IMAGE${referenceImages.length === 1 ? '' : 'S'} (${refRange}): ` +
          `Analyze these for style, materials, textures, colors, mood, lighting, and artistic qualities. ` +
          `Apply these visual characteristics to the generated image.`
        );
        partIndex = refEnd + 1;
      }

      // Context images: general context (untagged)
      if (hasContext) {
        const ctxEnd = partIndex + contextImages.length - 1;
        const ctxRange = contextImages.length === 1
          ? `part ${partIndex}`
          : `parts ${partIndex}-${ctxEnd}`;
        preambleParts.push(
          `CONTEXT IMAGE${contextImages.length === 1 ? '' : 'S'} (${ctxRange}): ` +
          `Use these as general visual context and inspiration for the generation.`
        );
      }

      const preamble = preambleParts.join('\n\n');
      finalPrompt = `${preamble}\n\nUSER PROMPT: ${prompt}`;
    }

    // [TEMP DEBUG] Log the final prompt and payload structure
    console.log('[Payload Debug] Final prompt being sent:');
    console.log('─'.repeat(60));
    console.log(finalPrompt);
    console.log('─'.repeat(60));
    console.log('[Payload Debug] Parts structure:', {
      totalParts: parts.length + 1, // +1 for the text part we're about to add
      imageParts: parts.length,
      controlImages: controlImages.length,
      referenceImages: referenceImages.length,
      contextImages: contextImages.length
    });

    parts.push({ text: finalPrompt });

    // Construct image config
    const imageConfig: any = {
        aspectRatio: config.aspect_ratio,
    };

    // imageSize is only supported by gemini-3-pro-image-preview
    if (config.model === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = config.image_size;
    }

    // Use selected model, default to flash image if none specified
    const modelName = config.model || 'gemini-2.5-flash-image';

    const requestOptions = userName
      ? {
          headers: {
            'X-User-Name': userName
          }
        }
      : undefined;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        // Nano Banana / Imagen configs
        imageConfig: imageConfig
        // safetySettings could be added here
      },
      // @ts-expect-error Request options are allowed at runtime for transport metadata
      requestOptions
    });

    // Extract image
    // The response structure for image generation often contains the image in inlineData of the first candidate part
    // Iterate to find image part
    const images: string[] = [];
    const texts: string[] = [];

    // Gather all parts from all candidates to capture multiple images/text chunks
    response.candidates?.forEach(candidate => {
      candidate.content?.parts?.forEach(part => {
        if (part.inlineData?.data) {
          images.push(part.inlineData.data);
        }
        if (typeof part.text === 'string' && part.text.trim().length > 0) {
          texts.push(part.text);
        }
      });
    });

    if (images.length === 0 && texts.length === 0) {
      throw new Error("No output data found in response");
    }

    return { images, texts };
  },

  generateText: async (
    prompt: string,
    config: GenerationConfig,
    maxWords: number = 150,
    userName?: string,
    referenceImageBase64?: string[] | string
  ): Promise<{ text: string }> => {

    // Get API key based on environment
    let apiKey: string | undefined;

    if (isElectron()) {
      const storedKey = localStorage.getItem('gemini_api_key');
      if (!storedKey || !storedKey.trim()) {
        throw new Error("API Key not configured. Please go to Settings to enter your Google AI API key.");
      }
      apiKey = storedKey.trim();
    } else {
      apiKey = AppConfig.getSharedApiKey();
      if (!apiKey) {
        throw new Error("Shared API key not configured.");
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use a text model for text generation
    const textModel = 'gemini-2.0-flash-exp';

    const parts: Part[] = [];

    const referenceImages = referenceImageBase64
      ? Array.isArray(referenceImageBase64)
        ? referenceImageBase64
        : [referenceImageBase64]
      : [];

    referenceImages.forEach((image, idx) => {
      try {
        const base64Data = stripBase64Header(image);
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: base64Data
          }
        });
      } catch (err) {
        console.error(`[GeminiService] Invalid reference image at index ${idx}:`, err);
        throw new Error(`Reference image ${idx + 1} is invalid: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    });

    const rangeSummary =
      referenceImages.length > 0
        ? `Context images provided (parts 1-${referenceImages.length}). Analyse the content of context images and respond to the requests.`
        : '';

    // Construct prompt with word limit
    const finalPrompt = `${rangeSummary ? `${rangeSummary}\n\n` : ''}${prompt}\n\n(Generate a concise response in ${maxWords} words or less)`;

    const requestOptions = userName
      ? {
          headers: {
            'X-User-Name': userName
          }
        }
      : undefined;

    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: textModel,
      contents: { parts },
      config: {
        maxOutputTokens: Math.ceil(maxWords * 1.5), // Approximate tokens from words
        temperature: config.temperature || 0.7,
        topP: config.top_p || 0.95
      },
      // @ts-expect-error Request options are allowed at runtime
      requestOptions
    });

    // Extract text from response
    let text = '';
    response.candidates?.forEach(candidate => {
      candidate.content?.parts?.forEach(part => {
        if (typeof part.text === 'string') {
          text += part.text;
        }
      });
    });

    if (!text || text.trim().length === 0) {
      throw new Error("No text generated");
    }

    return { text: text.trim() };
  }
};