import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { PromptPanel } from './components/PromptPanel';
import { MultiImageUploadPanel } from './components/MultiImageUploadPanel';
import { ParametersPanel } from './components/ParametersPanel';
import { ResultPanel } from './components/ResultPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsModal } from './components/SettingsModal';
import GraphView from './components/GraphView';
import { StorageService } from './services/newStorageService';
import { GeminiService } from './services/geminiService';
import { Session, SessionGeneration, GenerationConfig } from './types';
import { Zap, Database, Key, ExternalLink, History, Network, Layers } from 'lucide-react';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Active Generation Inputs
  const [prompt, setPrompt] = useState<string>('');
  const [controlImagesData, setControlImagesData] = useState<string[]>([]);
  const [referenceImagesData, setReferenceImagesData] = useState<string[]>([]);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);

  // Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<SessionGeneration | null>(null);
  const [outputImageData, setOutputImageData] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  // API Key State
  const [apiKeyConnected, setApiKeyConnected] = useState(false);

  // Settings & Theme State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mainView, setMainView] = useState<'result' | 'graph'>('result');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Get current session
  const currentSession = sessions.find(s => s.session_id === currentSessionId) || null;

  // --- EFFECTS ---
  useEffect(() => {
    // Load initial data
    const loadedSessions = StorageService.getSessions();
    setSessions(loadedSessions);
    if (loadedSessions.length > 0) {
      handleSelectSession(loadedSessions[0].session_id);
    } else {
      handleNewSession();
    }

    // Check API Key Status
    GeminiService.checkApiKey().then(setApiKeyConnected);

    // Initial Theme Setup
    const storedTheme = localStorage.getItem('app_theme') as 'dark' | 'light' | null;
    if (storedTheme) {
        setTheme(storedTheme);
        if (storedTheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark'); // Default
    }
  }, []);

  // --- HANDLERS ---
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleNewSession = () => {
    const newSession = StorageService.createSession();
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.session_id);
    resetInputs();
  };

  const handleDeleteSession = (id: string) => {
      StorageService.deleteSession(id);
      const remaining = sessions.filter(s => s.session_id !== id);
      setSessions(remaining);
      if (currentSessionId === id) {
          if (remaining.length > 0) {
              handleSelectSession(remaining[0].session_id);
          } else {
              handleNewSession();
          }
      }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    StorageService.renameSession(id, newTitle);
    setSessions(StorageService.getSessions());
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    const session = StorageService.loadSession(id);
    if (!session) return;

    // If the session has generations, load the most recent one
    if (session.generations.length > 0) {
      const lastGen = session.generations[session.generations.length - 1];
      loadGenerationIntoView(lastGen);
    } else {
        resetInputs();
    }
  };

  const handleSelectGeneration = (gen: SessionGeneration) => {
    loadGenerationIntoView(gen);
  };

  const loadGenerationIntoView = (gen: SessionGeneration) => {
    setPrompt(gen.prompt);
    setConfig(gen.parameters);
    setCurrentGeneration(gen);

    // Load control images
    if (gen.control_images && gen.control_images.length > 0) {
      const imagesData = gen.control_images
        .map(img => StorageService.loadImage('control', img.id, img.filename))
        .filter(data => data !== null) as string[];
      setControlImagesData(imagesData);
    } else {
      setControlImagesData([]);
    }

    // Load reference images
    if (gen.reference_images && gen.reference_images.length > 0) {
      const imagesData = gen.reference_images
        .map(img => StorageService.loadImage('reference', img.id, img.filename))
        .filter(data => data !== null) as string[];
      setReferenceImagesData(imagesData);
    } else {
      setReferenceImagesData([]);
    }

    // Load output image
    if (gen.output_image) {
      const imageData = StorageService.loadImage('output', gen.output_image.id, gen.output_image.filename);
      setOutputImageData(imageData);
    } else {
      setOutputImageData(null);
    }
  };

  const resetInputs = () => {
    setPrompt("");
    setControlImagesData([]);
    setReferenceImagesData([]);
    setConfig(DEFAULT_CONFIG);
    setCurrentGeneration(null);
    setOutputImageData(null);
  };

  const handleImageUpload = async (file: File, role: 'control' | 'reference') => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (role === 'control') {
          setControlImagesData(prev => [...prev, base64]);
        } else {
          setReferenceImagesData(prev => [...prev, base64]);
        }
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (index: number, role: 'control' | 'reference') => {
    if (role === 'control') {
      setControlImagesData(prev => prev.filter((_, i) => i !== index));
    } else {
      setReferenceImagesData(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleExportImage = (filename: string) => {
    const success = StorageService.exportImage(filename);
    if (success) {
      alert('Image exported successfully!');
    } else {
      alert('Failed to export image');
    }
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

  const handleApiKeyUpdate = async () => {
      const isConnected = await GeminiService.checkApiKey();
      setApiKeyConnected(isConnected);
  };

  const handleGenerate = async () => {
    if (!currentSessionId || !prompt) return;

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
    setOutputImageData(null);
    setRetryStatus(null);

    // 2. Create Generation Record
    const gen = StorageService.createGeneration(
        currentSessionId,
        prompt,
        config,
        controlImagesData.length > 0 ? controlImagesData : undefined,
        referenceImagesData.length > 0 ? referenceImagesData : undefined
    );
    setCurrentGeneration(gen);

    const startTime = Date.now();

    try {
        // 3. API Call with retry callback
        const base64Output = await GeminiService.generateImage(
            prompt,
            config,
            controlImagesData[0] || undefined,
            referenceImagesData[0] || undefined,
            (attempt: number, error: any, delayMs: number) => {
              // Update UI with retry status
              const errorMsg = error.message || error.toString();
              const waitSeconds = Math.ceil(delayMs / 1000);
              setRetryStatus(`API temporarily unavailable. Retry ${attempt}/4 in ${waitSeconds}s...`);
            }
        );

        const duration = Date.now() - startTime;

        // 4. Complete Generation and Save Output
        const outputDataUri = `data:image/png;base64,${base64Output}`;
        StorageService.completeGeneration(currentSessionId, gen.generation_id, outputDataUri, duration);

        // 5. Reload session and update UI
        const updatedSession = StorageService.loadSession(currentSessionId);
        if (updatedSession) {
          const completedGen = updatedSession.generations.find(g => g.generation_id === gen.generation_id);
          if (completedGen) {
            setCurrentGeneration(completedGen);
            if (completedGen.output_image) {
              const outputData = StorageService.loadImage('output', completedGen.output_image.id, completedGen.output_image.filename);
              setOutputImageData(outputData);
            }
          }
        }

        // Update sessions list to show new activity
        setSessions(StorageService.getSessions());

        // Clear retry status on success
        setRetryStatus(null);

    } catch (error: any) {
        console.error("Generation failed:", error);

        const errorMessage = error.message || error.toString();

        if (errorMessage.includes("Requested entity was not found")) {
            setApiKeyConnected(false);
            alert("The selected API Key is no longer valid or the project was not found. Please select a valid key.");
            if (config.model === 'gemini-3-pro-image-preview') {
                 await handleConnectApiKey();
            }
        }

        StorageService.failGeneration(currentSessionId, gen.generation_id, errorMessage);

        // Reload generation with error
        const updatedSession = StorageService.loadSession(currentSessionId);
        if (updatedSession) {
          const failedGen = updatedSession.generations.find(g => g.generation_id === gen.generation_id);
          if (failedGen) setCurrentGeneration(failedGen);
        }

        // Clear retry status on final failure
        setRetryStatus(null);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-200 ${theme === 'dark' ? 'bg-black text-zinc-100' : 'bg-white text-zinc-900'}`}>
      
      {/* SIDEBAR */}
      <Sidebar
        chats={sessions.map(s => ({
          chat_id: s.session_id,
          created_at: s.created_at,
          updated_at: s.updated_at,
          title: s.title,
          description: '',
          generation_ids: s.generations.map(g => g.generation_id)
        }))}
        currentChatId={currentSessionId}
        onSelectChat={handleSelectSession}
        onNewChat={handleNewSession}
        onDeleteChat={handleDeleteSession}
        onRenameChat={handleRenameSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black">
        
        {/* Top Bar */}
        <header
          className="h-14 border-b bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 backdrop-blur flex items-center justify-between px-6 transition-colors duration-200 sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <Database size={16} />
                <span className="text-sm font-medium tracking-wide">AREA49 - NANO BANANA UI</span>
                <span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700">
                  {StorageService.isElectron() ? "DESKTOP" : "WEB PREVIEW"}
                </span>
            </div>

            <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {/* Main View Toggle */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setMainView('result')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      mainView === 'result'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers size={12} />
                    Result View
                  </button>
                  <button
                    onClick={() => setMainView('graph')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      mainView === 'graph'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Network size={12} />
                    Graph View
                  </button>
                </div>

                {/* History Toggle (only in Result View) */}
                {mainView === 'result' && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                      showHistory
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-900 text-blue-700 dark:text-blue-400'
                        : 'bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <History size={12} />
                    History ({currentSession?.generations.length || 0})
                  </button>
                )}

                {config.model === 'gemini-3-pro-image-preview' && (
                    <a
                      href="https://ai.google.dev/gemini-api/docs/billing"
                      target="_blank"
                      rel="noreferrer"
                      className="hidden md:flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-500 transition-colors"
                    >
                      <ExternalLink size={10} />
                      Billing Requirements (Pro Model)
                    </a>
                )}

                {!apiKeyConnected && (
                    <button 
                        onClick={handleConnectApiKey}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                            config.model === 'gemini-3-pro-image-preview'
                                ? 'text-yellow-700 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-900'
                                : 'text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 shadow-sm'
                        }`}
                        title={config.model === 'gemini-3-pro-image-preview' ? "Required for Pro Model" : "Optional for Flash Model"}
                    >
                        <Key size={12} />
                        {config.model === 'gemini-3-pro-image-preview' ? "Connect Google AI Studio (Required)" : "Connect Google AI Studio"}
                    </button>
                )}
                {apiKeyConnected && (
                     <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded border border-green-300 dark:border-green-900 font-medium">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                         API Connected
                     </div>
                )}
            </div>
        </header>

        {/* Content Area */}
        {mainView === 'graph' ? (
          /* Graph View - Full Screen */
          <div className="flex-1 overflow-hidden">
            {currentSession ? (
              <GraphView
                session={currentSession}
                theme={theme}
                loadImage={(role, id, filename) => StorageService.loadImage(role, id, filename)}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                <div className="text-center text-zinc-500 dark:text-zinc-400">
                  <Network size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No Session Selected</p>
                  <p className="text-sm mt-2">Select a session from the sidebar to view its graph</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Result View - Original Layout */
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-black/50">
            <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">

                {/* Left Column: Inputs (8/12) */}
                <div className="col-span-12 lg:col-span-8 space-y-6">

                    {/* Prompt */}
                    <PromptPanel prompt={prompt} setPrompt={setPrompt} />

                    {/* Image Controls Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <MultiImageUploadPanel
                            title="Control Images"
                            description="For structure/composition"
                            images={controlImagesData}
                            onUpload={(f) => handleImageUpload(f, 'control')}
                            onRemove={(idx) => handleImageRemove(idx, 'control')}
                            maxImages={5}
                        />
                        <MultiImageUploadPanel
                            title="Reference Images"
                            description="For style transfer"
                            images={referenceImagesData}
                            onUpload={(f) => handleImageUpload(f, 'reference')}
                            onRemove={(idx) => handleImageRemove(idx, 'reference')}
                            maxImages={5}
                        />
                    </div>

                    {/* Output Area or History */}
                    <div className="h-[500px]">
                        {showHistory && currentSession ? (
                            <HistoryPanel
                                generations={currentSession.generations}
                                onSelectGeneration={handleSelectGeneration}
                                selectedGenerationId={currentGeneration?.generation_id}
                                onExportImage={handleExportImage}
                                loadImage={(role, id, filename) => StorageService.loadImage(role, id, filename)}
                            />
                        ) : (
                            <ResultPanel
                                isGenerating={isGenerating}
                                generation={currentGeneration as any}
                                outputImage={outputImageData ? { data_uri: outputImageData } as any : null}
                                retryStatus={retryStatus}
                            />
                        )}
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
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 dark:shadow-blue-900/20'
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
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-xs space-y-2 text-zinc-500 font-mono transition-colors shadow-sm">
                            <div className="flex justify-between">
                                <span>ID:</span>
                                <span className="text-zinc-700 dark:text-zinc-400">{currentGeneration.generation_id.slice(0,8)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Status:</span>
                                <span className="text-zinc-700 dark:text-zinc-400">{currentGeneration.status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Time:</span>
                                <span className="text-zinc-700 dark:text-zinc-400">{currentGeneration.generation_time_ms || 0}ms</span>
                            </div>
                        </div>
                    )}
                </div>

            </div>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        onApiKeyUpdate={handleApiKeyUpdate}
      />
    </div>
  );
}