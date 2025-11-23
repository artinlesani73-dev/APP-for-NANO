import { GoogleGenAI, Part } from "@google/genai";
import { GenerationConfig } from "../types";

// Helper to remove data URL prefix for API
const stripBase64Header = (dataUrl: string) => {
  return dataUrl.split(',')[1];
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
    referenceImageBase64?: string
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
  }
};