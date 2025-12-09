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

  // Use regex to strip data URI prefix (handles various image formats)
  const stripped = dataUrl.replace(/^data:image\/\w+;base64,/, '');

  // If regex didn't match (already raw base64), return as-is after validation
  if (stripped === dataUrl) {
    // Validate it looks like base64 (basic check)
    if (!/^[A-Za-z0-9+/]/.test(stripped)) {
      throw new Error('Invalid image data: not a valid data URL or base64 string');
    }
    return stripped;
  }

  // Validate the stripped result isn't empty
  if (!stripped || stripped.trim() === '') {
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

    // Add a structured preamble so the model knows how many and which images are controls vs references.
    // We describe the order and role of each slice of parts.
    let finalPrompt = prompt;
    if (controlImages.length > 0 || referenceImages.length > 0) {
      const hasControls = controlImages.length > 0;
      const hasReferences = referenceImages.length > 0;

      const controlRange = hasControls
        ? `control image${controlImages.length === 1 ? '' : 's'} (parts 1-${controlImages.length})`
        : '';

      const referenceStart = controlImages.length + 1;
      const referenceRange = hasReferences
        ? `reference image${referenceImages.length === 1 ? '' : 's'} (parts ${referenceStart}-${referenceStart + referenceImages.length - 1})`
        : '';

      const rangeSummary = [controlRange, referenceRange].filter(Boolean).join('; ');
      const contextNote = rangeSummary
        ? `Context images: ${rangeSummary}. Analyse the content of context images and respond to the requests.`
        : '';
      finalPrompt = `${contextNote ? `${contextNote}\n\n` : ''}${prompt}`;
    }

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