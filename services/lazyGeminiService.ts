type GeminiServiceType = typeof import('./geminiService')['GeminiService'];

let cachedServicePromise: Promise<GeminiServiceType> | null = null;

export const loadGeminiService = async (): Promise<GeminiServiceType> => {
  if (!cachedServicePromise) {
    cachedServicePromise = import('./geminiService').then((module) => module.GeminiService);
  }
  return cachedServicePromise;
};
