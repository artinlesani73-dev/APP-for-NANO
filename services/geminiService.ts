import { GoogleGenAI, Part } from "@google/genai";
import { GenerationConfig } from "../types";

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  initialDelayMs: 2000,
  maxDelayMs: 16000
};

// Helper to remove data URL prefix for API
const stripBase64Header = (dataUrl: string) => {
  return dataUrl.split(',')[1];
};

const isElectron = () => {
  // @ts-ignore
  return window.electron !== undefined;
};

// Check if error is retryable (transient failures)
const isRetryableError = (error: any): boolean => {
  const errorMessage = error.message || error.toString();
  const errorStr = JSON.stringify(error).toLowerCase();

  // Check for HTTP status codes in error
  const retryableCodes = [429, 500, 502, 503, 504];
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }
  if (error.status && retryableCodes.includes(error.status)) {
    return true;
  }

  // Check error object for status codes
  if (error.error && error.error.code && retryableCodes.includes(error.error.code)) {
    return true;
  }

  // Check for retryable messages
  const retryableMessages = [
    'overloaded',
    'unavailable',
    'timeout',
    'network error',
    'connection',
    'econnreset',
    'etimedout',
    'rate limit',
    'too many requests',
    'service unavailable'
  ];

  return retryableMessages.some(msg =>
    errorMessage.toLowerCase().includes(msg) || errorStr.includes(msg)
  );
};

// Calculate exponential backoff delay with jitter
const getRetryDelay = (attempt: number, config: RetryConfig): number => {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(2, attempt),
    config.maxDelayMs
  );
  // Add jitter (up to 30% of delay) to avoid thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return Math.floor(delay + jitter);
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: any, delayMs: number) => void
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === config.maxRetries) {
        console.error(`All ${config.maxRetries} retry attempts exhausted`);
        throw error;
      }

      if (!isRetryableError(error)) {
        console.error('Non-retryable error encountered:', error);
        throw error;
      }

      const delay = getRetryDelay(attempt, config);

      console.log(`Retryable error encountered (attempt ${attempt + 1}/${config.maxRetries}):`, error);
      console.log(`Waiting ${delay}ms before retry...`);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

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
    return false;
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
    controlImageBase64?: string,
    referenceImageBase64?: string,
    onRetry?: (attempt: number, error: any, delayMs: number) => void
  ): Promise<string> => {

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
      // @ts-ignore - In AI Studio, the SDK picks up the key from process.env
      apiKey = process.env.API_KEY;
    }

    // Create AI instance with the API key
    const ai = new GoogleGenAI({ apiKey });

    const parts: Part[] = [];

    // Add images to parts if they exist
    // Note: Gemini 'generateContent' takes context images.
    // We treat Control/Reference as multimodal inputs.
    if (controlImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png', // Assuming PNG for simplicity in this demo, actual app would preserve mime
          data: stripBase64Header(controlImageBase64)
        }
      });
      prompt += "\n\n(Use the first image as a structural control/composition reference.)";
    }

    if (referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: stripBase64Header(referenceImageBase64)
        }
      });
      prompt += "\n\n(Use the second image as a style reference.)";
    }

    parts.push({ text: prompt });

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

    // Wrap API call with retry logic
    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          // Nano Banana / Imagen configs
          imageConfig: imageConfig
          // safetySettings could be added here
        },
      });

      // Extract image
      // The response structure for image generation often contains the image in inlineData of the first candidate part
      // Iterate to find image part
      if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                  return part.inlineData.data;
              }
          }
      }

      throw new Error("No image data found in response");
    }, DEFAULT_RETRY_CONFIG, onRetry);
  }
};