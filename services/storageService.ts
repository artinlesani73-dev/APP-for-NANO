import { Chat, Generation, ImageRecord, Prompt, Relationship, ImageRole } from '../types';

// Detect Electron
const isElectron = () => {
  // @ts-ignore
  return typeof window.electron !== 'undefined';
};

// Utility for hashing
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

const generateUUID = () => {
  return crypto.randomUUID();
};

const KEYS = {
  CHAT: 'app_chat_',
  PROMPT: 'app_prompt_',
  IMAGE: 'app_image_',
  GEN: 'app_gen_',
  REL: 'app_rel_',
};

// Backend Abstraction
const Backend = {
  save: (key: string, data: any) => {
    if (isElectron()) {
      // @ts-ignore
      window.electron.saveSync(key, JSON.stringify(data));
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  },
  
  load: <T>(key: string): T | null => {
    let item: string | null = null;
    if (isElectron()) {
      // @ts-ignore
      item = window.electron.loadSync(key);
    } else {
      item = localStorage.getItem(key);
    }
    return item ? JSON.parse(item) : null;
  },

  delete: (key: string) => {
      if (isElectron()) {
          // @ts-ignore
          window.electron.deleteSync(key);
      } else {
          localStorage.removeItem(key);
      }
  },

  loadAll: <T>(prefix: string): T[] => {
    const items: T[] = [];
    if (isElectron()) {
        // @ts-ignore
        const allFiles = window.electron.listFilesSync(prefix); // Returns array of { key, content }
        // @ts-ignore
        allFiles.forEach(f => {
             try {
                 items.push(JSON.parse(f.content));
             } catch(e) {}
        });
    } else {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
            const val = localStorage.getItem(key);
            if (val) items.push(JSON.parse(val));
            }
        }
    }
    return items;
  },
  
  exportAll: (): string => {
      // Logic for web export
      const dump: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('app_')) {
            dump[key] = localStorage.getItem(key);
        }
      }
      return JSON.stringify(dump, null, 2);
  }
};

export const StorageService = {
  isElectron: isElectron,

  // --- EXPORT / IMPORT ---
  exportData: (): string => {
    return Backend.exportAll();
  },

  importData: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (typeof data !== 'object') return false;

      // Only supporting web import for now as Electron auto-saves to disk
      if (!isElectron()) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('app_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
          Object.keys(data).forEach(key => {
            if (key.startsWith('app_')) {
              localStorage.setItem(key, data[key]);
            }
          });
      }
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
    Backend.save(KEYS.CHAT + chat.chat_id, chat);
    return chat;
  },

  getChats: (): Chat[] => {
    return Backend.loadAll<Chat>(KEYS.CHAT).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  getChat: (chatId: string): Chat | null => {
    return Backend.load<Chat>(KEYS.CHAT + chatId);
  },

  updateChat: (chat: Chat) => {
    chat.updated_at = new Date().toISOString();
    Backend.save(KEYS.CHAT + chat.chat_id, chat);
  },

  deleteChat: (chatId: string) => {
    Backend.delete(KEYS.CHAT + chatId);
  },

  // --- PROMPTS ---
  savePrompt: (text: string): Prompt => {
    const hash = simpleHash(text.trim().toLowerCase());
    const existing = Backend.load<Prompt>(KEYS.PROMPT + hash);
    
    if (existing) {
      existing.used_count++;
      Backend.save(KEYS.PROMPT + hash, existing);
      return existing;
    }

    const prompt: Prompt = {
      prompt_id: generateUUID(),
      prompt_hash: hash,
      text: text.trim(),
      created_at: new Date().toISOString(),
      used_count: 1,
    };
    Backend.save(KEYS.PROMPT + hash, prompt);
    return prompt;
  },

  getPrompt: (hash: string): Prompt | null => {
    return Backend.load<Prompt>(KEYS.PROMPT + hash);
  },

  // --- IMAGES ---
  saveImage: (file: File, role: ImageRole, base64Data: string): ImageRecord => {
    const hash = simpleHash(base64Data);
    const existing = Backend.load<ImageRecord>(KEYS.IMAGE + hash);
    if (existing) return existing;

    const img: ImageRecord = {
      image_id: generateUUID(),
      image_hash: hash,
      role,
      data_uri: base64Data,
      created_at: new Date().toISOString(),
      metadata: {
        width: 0,
        height: 0,
        size_bytes: file.size,
        mime_type: file.type,
      }
    };
    Backend.save(KEYS.IMAGE + hash, img);
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
            size_bytes: Math.floor((base64Data.length * 3) / 4),
            mime_type: 'image/png'
        }
     };
     Backend.save(KEYS.IMAGE + hash, img);
     return img;
  },

  getImage: (hash: string): ImageRecord | null => {
    return Backend.load<ImageRecord>(KEYS.IMAGE + hash);
  },

  // --- GENERATIONS ---
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
    Backend.save(KEYS.GEN + gen.generation_id, gen);
    
    const chat = Backend.load<Chat>(KEYS.CHAT + chatId);
    if (chat) {
        chat.generation_ids.push(gen.generation_id);
        StorageService.updateChat(chat);
    }
    
    return gen;
  },

  completeGeneration: (genId: string, outputImageHash: string, timeMs: number) => {
    const gen = Backend.load<Generation>(KEYS.GEN + genId);
    if (!gen) return;

    gen.status = 'completed';
    gen.outputs = {
      image_hash: outputImageHash,
      generation_time_ms: timeMs,
    };
    Backend.save(KEYS.GEN + genId, gen);

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
    
    Backend.save(KEYS.REL + rel.relationship_id, rel);
  },

  failGeneration: (genId: string, error: string) => {
    const gen = Backend.load<Generation>(KEYS.GEN + genId);
    if (!gen) return;
    gen.status = 'failed';
    gen.error = error;
    Backend.save(KEYS.GEN + genId, gen);
  },

  getGeneration: (genId: string): Generation | null => {
      return Backend.load<Generation>(KEYS.GEN + genId);
  }
};