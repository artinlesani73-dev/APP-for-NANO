import { Chat, Generation, ImageRecord, Prompt, Relationship, ImageRole } from '../types';

// Utility for hashing (Simple DJB2/String conversion for demo purposes as crypto.subtle is async and complex for synchronous local storage simulation, 
// but we will stick to a simple persistent ID generation for "hashes" in this demo environment).
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

const generateUUID = () => {
  return crypto.randomUUID();
};

// Key Prefixes
const KEYS = {
  CHAT: 'app_chat_',
  PROMPT: 'app_prompt_',
  IMAGE: 'app_image_',
  GEN: 'app_gen_',
  REL: 'app_rel_',
};

// Helper to save/load
const save = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const load = <T>(key: string): T | null => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
};
const loadAll = <T>(prefix: string): T[] => {
  const items: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const val = load<T>(key);
      if (val) items.push(val);
    }
  }
  return items;
};

export const StorageService = {
  // --- EXPORT / IMPORT ---
  exportData: (): string => {
    const dump: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('app_')) {
        dump[key] = localStorage.getItem(key);
      }
    }
    return JSON.stringify(dump, null, 2);
  },

  importData: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (typeof data !== 'object') return false;

      // Clear current app data (keep others if any)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('app_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Import new
      Object.keys(data).forEach(key => {
        if (key.startsWith('app_')) {
          localStorage.setItem(key, data[key]);
        }
      });
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  // --- CHATS ---
  createChat: (title: string = "New Session"): Chat => {
    const chat: Chat = {
      chat_id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      title,
      description: "",
      generation_ids: [],
    };
    save(KEYS.CHAT + chat.chat_id, chat);
    return chat;
  },

  getChats: (): Chat[] => {
    return loadAll<Chat>(KEYS.CHAT).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  getChat: (chatId: string): Chat | null => {
    return load<Chat>(KEYS.CHAT + chatId);
  },

  updateChat: (chat: Chat) => {
    chat.updated_at = new Date().toISOString();
    save(KEYS.CHAT + chat.chat_id, chat);
  },

  deleteChat: (chatId: string) => {
    localStorage.removeItem(KEYS.CHAT + chatId);
  },

  // --- PROMPTS ---
  savePrompt: (text: string): Prompt => {
    const hash = simpleHash(text.trim().toLowerCase());
    const existing = load<Prompt>(KEYS.PROMPT + hash);
    
    if (existing) {
      existing.used_count++;
      save(KEYS.PROMPT + hash, existing);
      return existing;
    }

    const prompt: Prompt = {
      prompt_id: generateUUID(),
      prompt_hash: hash,
      text: text.trim(),
      created_at: new Date().toISOString(),
      used_count: 1,
    };
    save(KEYS.PROMPT + hash, prompt);
    return prompt;
  },

  getPrompt: (hash: string): Prompt | null => {
    return load<Prompt>(KEYS.PROMPT + hash);
  },

  // --- IMAGES ---
  saveImage: (file: File, role: ImageRole, base64Data: string): ImageRecord => {
    // In a real app, we'd hash the binary buffer. Here we hash the base64 string.
    const hash = simpleHash(base64Data);
    const existing = load<ImageRecord>(KEYS.IMAGE + hash);

    if (existing) {
      // If we are saving a control/reference, we might be reusing it. 
      // If it's output, it might be a duplicate generation (unlikely with seed var).
      return existing;
    }

    const img: ImageRecord = {
      image_id: generateUUID(),
      image_hash: hash,
      role,
      data_uri: base64Data,
      created_at: new Date().toISOString(),
      metadata: {
        width: 0, // We would calculate this with an Image object in a real app
        height: 0,
        size_bytes: file.size,
        mime_type: file.type,
      }
    };
    save(KEYS.IMAGE + hash, img);
    return img;
  },
  
  saveGeneratedImage: (base64Data: string): ImageRecord => {
     const hash = simpleHash(base64Data);
     const img: ImageRecord = {
        image_id: generateUUID(),
        image_hash: hash,
        role: 'output',
        data_uri: `data:image/png;base64,${base64Data}`,
        created_at: new Date().toISOString(),
        metadata: {
            width: 1024,
            height: 1024,
            size_bytes: Math.floor((base64Data.length * 3) / 4), // Approx
            mime_type: 'image/png'
        }
     };
     save(KEYS.IMAGE + hash, img);
     return img;
  },

  getImage: (hash: string): ImageRecord | null => {
    return load<ImageRecord>(KEYS.IMAGE + hash);
  },

  // --- GENERATIONS & RELATIONSHIPS ---
  createGeneration: (
    chatId: string, 
    promptHash: string, 
    config: any,
    controlHash?: string, 
    refHash?: string
  ): Generation => {
    const gen: Generation = {
      generation_id: generateUUID(),
      chat_id: chatId,
      timestamp: new Date().toISOString(),
      status: 'pending',
      inputs: {
        prompt_hash: promptHash,
        control_image_hash: controlHash || null,
        reference_image_hash: refHash || null,
      },
      parameters: config,
    };
    save(KEYS.GEN + gen.generation_id, gen);
    
    // Link to chat
    const chat = load<Chat>(KEYS.CHAT + chatId);
    if (chat) {
        chat.generation_ids.push(gen.generation_id);
        StorageService.updateChat(chat);
    }
    
    return gen;
  },

  completeGeneration: (genId: string, outputImageHash: string, timeMs: number) => {
    const gen = load<Generation>(KEYS.GEN + genId);
    if (!gen) return;

    gen.status = 'completed';
    gen.outputs = {
      image_hash: outputImageHash,
      generation_time_ms: timeMs,
    };
    save(KEYS.GEN + genId, gen);

    // Create Relationship Graph
    const rel: Relationship = {
        relationship_id: generateUUID(),
        generation_id: genId,
        nodes: {
            prompt: gen.inputs.prompt_hash,
            control_image: gen.inputs.control_image_hash || undefined,
            reference_image: gen.inputs.reference_image_hash || undefined,
            output_image: outputImageHash
        },
        graph: []
    };

    rel.graph.push({ from: gen.inputs.prompt_hash, to: outputImageHash, type: 'generates' });
    if (gen.inputs.control_image_hash) {
        rel.graph.push({ from: gen.inputs.control_image_hash, to: outputImageHash, type: 'controls' });
    }
    if (gen.inputs.reference_image_hash) {
        rel.graph.push({ from: gen.inputs.reference_image_hash, to: outputImageHash, type: 'references' });
    }
    
    save(KEYS.REL + rel.relationship_id, rel);
  },

  failGeneration: (genId: string, error: string) => {
    const gen = load<Generation>(KEYS.GEN + genId);
    if (!gen) return;
    gen.status = 'failed';
    gen.error = error;
    save(KEYS.GEN + genId, gen);
  },

  getGeneration: (genId: string): Generation | null => {
      return load<Generation>(KEYS.GEN + genId);
  }
};