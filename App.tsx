import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { PromptPanel } from './components/PromptPanel';
import { ImageUploadPanel } from './components/ImageUploadPanel';
import { ParametersPanel } from './components/ParametersPanel';
import { ResultPanel } from './components/ResultPanel';
import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { Chat, Generation, GenerationConfig, ImageRecord } from './types';
import { Zap, History, Database, Key, ExternalLink } from 'lucide-react';

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

export default function App() {
  // --- STATE ---
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Active Generation Inputs
  const [prompt, setPrompt] = useState<string>('');
  const [controlImage, setControlImage] = useState<ImageRecord | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageRecord | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  
  // Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<Generation | null>(null);
  const [outputImage, setOutputImage] = useState<ImageRecord | null>(null);

  // API Key State
  const [apiKeyConnected, setApiKeyConnected] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    // Load initial data
    const loadedChats = StorageService.getChats();
    setChats(loadedChats);
    if (loadedChats.length > 0) {
      handleSelectChat(loadedChats[0].chat_id);
    } else {
      handleNewChat();
    }
    
    // Check API Key Status
    GeminiService.checkApiKey().then(setApiKeyConnected);
  }, []);

  // --- HANDLERS ---
  const handleNewChat = () => {
    const newChat = StorageService.createChat();
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.chat_id);
    resetInputs();
  };

  const handleDeleteChat = (id: string) => {
      StorageService.deleteChat(id);
      const remaining = chats.filter(c => c.chat_id !== id);
      setChats(remaining);
      if (currentChatId === id) {
          if (remaining.length > 0) {
              handleSelectChat(remaining[0].chat_id);
          } else {
              handleNewChat();
          }
      }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    const chat = StorageService.getChat(id);
    if (!chat) return;
    
    // If the chat has generations, load the most recent one into view
    if (chat.generation_ids.length > 0) {
      const lastGenId = chat.generation_ids[chat.generation_ids.length - 1];
      const gen = StorageService.getGeneration(lastGenId);
      if (gen) {
        // Load state from history
        const promptObj = StorageService.getPrompt(gen.inputs.prompt_hash);
        setPrompt(promptObj?.text || "");
        
        if (gen.inputs.control_image_hash) {
            setControlImage(StorageService.getImage(gen.inputs.control_image_hash));
        } else setControlImage(null);

        if (gen.inputs.reference_image_hash) {
            setReferenceImage(StorageService.getImage(gen.inputs.reference_image_hash));
        } else setReferenceImage(null);

        setConfig(gen.parameters);
        setCurrentGeneration(gen);

        if (gen.outputs?.image_hash) {
            setOutputImage(StorageService.getImage(gen.outputs.image_hash));
        }
      }
    } else {
        resetInputs();
    }
  };

  const resetInputs = () => {
    setPrompt("");
    setControlImage(null);
    setReferenceImage(null);
    setConfig(DEFAULT_CONFIG);
    setCurrentGeneration(null);
    setOutputImage(null);
  };

  const handleImageUpload = async (file: File, role: 'control' | 'reference') => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const imgRecord = StorageService.saveImage(file, role, base64);
        if (role === 'control') setControlImage(imgRecord);
        else setReferenceImage(imgRecord);
    };
    reader.readAsDataURL(file);
  };

  const handleConnectApiKey = async () => {
      try {
          await GeminiService.requestApiKey();
          const isConnected = await GeminiService.checkApiKey();
          setApiKeyConnected(isConnected);
      } catch (e) {
          console.error("Failed to connect API Key", e);
          alert("Could not verify API Key selection.");
      }
  };

  const handleGenerate = async () => {
    if (!currentChatId || !prompt) return;

    // 1. Ensure API Key ONLY if model requires it (Pro models)
    if (config.model === 'gemini-3-pro-image-preview' && !apiKeyConnected) {
        await handleConnectApiKey();
        // Check again after flow
        const isConnected = await GeminiService.checkApiKey();
        if (!isConnected) return;
        setApiKeyConnected(true);
    }

    setIsGenerating(true);
    setCurrentGeneration(null);
    setOutputImage(null);

    // 2. Persist Inputs (Provenance)
    const promptObj = StorageService.savePrompt(prompt);
    
    // 3. Create Generation Record
    const gen = StorageService.createGeneration(
        currentChatId, 
        promptObj.prompt_hash, 
        config,
        controlImage?.image_hash, 
        referenceImage?.image_hash
    );
    setCurrentGeneration(gen);

    const startTime = Date.now();

    try {
        // 4. API Call
        const base64Output = await GeminiService.generateImage(
            prompt, 
            config, 
            controlImage?.data_uri,
            referenceImage?.data_uri
        );

        const duration = Date.now() - startTime;

        // 5. Save Artifacts
        const outputImg = StorageService.saveGeneratedImage(base64Output);
        
        // 6. Complete Record
        StorageService.completeGeneration(gen.generation_id, outputImg.image_hash, duration);
        
        // Update UI
        setCurrentGeneration(StorageService.getGeneration(gen.generation_id));
        setOutputImage(outputImg);

        // Update Chat List to show new activity timestamp
        setChats(StorageService.getChats());

    } catch (error: any) {
        console.error("Generation failed:", error);
        
        const errorMessage = error.message || error.toString();
        
        // Handle specific "Requested entity was not found" error to reset API key flow
        if (errorMessage.includes("Requested entity was not found")) {
            setApiKeyConnected(false);
            alert("The selected API Key is no longer valid or the project was not found. Please select a valid key.");
            // If they were trying to use Pro, prompt them.
            if (config.model === 'gemini-3-pro-image-preview') {
                 await handleConnectApiKey();
            }
        }

        StorageService.failGeneration(gen.generation_id, errorMessage);
        setCurrentGeneration(StorageService.getGeneration(gen.generation_id)); // reload with error state
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      
      {/* SIDEBAR */}
      <Sidebar 
        chats={chats} 
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Bar */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-zinc-400">
                <Database size={16} />
                <span className="text-sm font-medium tracking-wide">PROVENANCE STUDIO</span>
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">LOCAL</span>
            </div>
            
            <div className="flex items-center gap-4">
                {config.model === 'gemini-3-pro-image-preview' && (
                    <a 
                      href="https://ai.google.dev/gemini-api/docs/billing" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="hidden md:flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink size={10} />
                      Billing Requirements (Pro Model)
                    </a>
                )}

                {!apiKeyConnected && (
                    <button 
                        onClick={handleConnectApiKey}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors ${
                            config.model === 'gemini-3-pro-image-preview'
                                ? 'text-yellow-500 hover:text-yellow-400 bg-yellow-950/30 border-yellow-900'
                                : 'text-zinc-400 hover:text-zinc-300 bg-zinc-800/50 border-zinc-700'
                        }`}
                        title={config.model === 'gemini-3-pro-image-preview' ? "Required for Pro Model" : "Optional for Flash Model"}
                    >
                        <Key size={12} />
                        {config.model === 'gemini-3-pro-image-preview' ? "Connect Google AI Studio (Required)" : "Connect Google AI Studio"}
                    </button>
                )}
                {apiKeyConnected && (
                     <div className="flex items-center gap-2 text-xs text-green-500 bg-green-950/30 px-3 py-1.5 rounded border border-green-900">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                         API Connected
                     </div>
                )}
            </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
                
                {/* Left Column: Inputs (8/12) */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    
                    {/* Prompt */}
                    <PromptPanel prompt={prompt} setPrompt={setPrompt} />

                    {/* Image Controls Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUploadPanel 
                            title="Control Image" 
                            description="Use for structure/composition"
                            image={controlImage}
                            onUpload={(f) => handleImageUpload(f, 'control')}
                            onRemove={() => setControlImage(null)}
                        />
                        <ImageUploadPanel 
                            title="Reference Image" 
                            description="Use for style transfer"
                            image={referenceImage}
                            onUpload={(f) => handleImageUpload(f, 'reference')}
                            onRemove={() => setReferenceImage(null)}
                        />
                    </div>

                    {/* Output Area */}
                    <div className="h-[500px]">
                        <ResultPanel 
                            isGenerating={isGenerating} 
                            generation={currentGeneration} 
                            outputImage={outputImage} 
                        />
                    </div>
                </div>

                {/* Right Column: Parameters (4/12) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <ParametersPanel config={config} setConfig={setConfig} />
                    
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                        ${isGenerating || !prompt 
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20'
                        }`}
                    >
                        {isGenerating ? (
                            "Processing..."
                        ) : (
                            <>
                                <Zap size={20} fill="currentColor" />
                                Generate
                            </>
                        )}
                    </button>

                    {/* Meta Info */}
                    {currentGeneration && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs space-y-2 text-zinc-500 font-mono">
                            <div className="flex justify-between">
                                <span>ID:</span>
                                <span className="text-zinc-400">{currentGeneration.generation_id.slice(0,8)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Prompt Hash:</span>
                                <span className="text-zinc-400">{currentGeneration.inputs.prompt_hash.slice(0,8)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Time:</span>
                                <span className="text-zinc-400">{currentGeneration.outputs?.generation_time_ms}ms</span>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
      </div>
    </div>
  );
}