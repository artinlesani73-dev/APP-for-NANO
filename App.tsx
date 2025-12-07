import React, { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { PromptPanel } from './components/PromptPanel';
import { MultiImageUploadPanel } from './components/MultiImageUploadPanel';
import { ParametersPanel } from './components/ParametersPanel';
import { ResultPanel } from './components/ResultPanel';
import type { HistoryGalleryItem } from './components/HistoryPanel';
import { LoginForm } from './components/LoginForm';
import { UserProvider, useUser } from './components/UserContext';
import { StorageService } from './services/newStorageService';
import { GeminiService } from './services/geminiService';
import { LoggerService } from './services/logger';
import { PreferencesService, type UserHistory, type UserSettings } from './services/preferencesService';
import { Session, SessionGeneration, GenerationConfig, UploadedImagePayload, MixboardSession } from './types';
import { Database, Key, ExternalLink, History, Network, Sparkles, Settings } from 'lucide-react';

const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(module => ({ default: module.HistoryPanel })));
const GraphView = lazy(() => import('./components/GraphView'));
const MixboardView = lazy(() => import('./components/MixboardView').then(module => ({ default: module.MixboardView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));
const ImageEditModal = lazy(() => import('./components/ImageEditModal').then(module => ({ default: module.ImageEditModal })));

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

function AppContent() {
  // --- STATE ---
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { currentUser, setCurrentUser, logout: userLogout } = useUser();

  // Active Generation Inputs
  const [prompt, setPrompt] = useState<string>('');
  const [controlImagesData, setControlImagesData] = useState<UploadedImagePayload[]>([]);
  const [referenceImagesData, setReferenceImagesData] = useState<UploadedImagePayload[]>([]);
  const [editingControlIndex, setEditingControlIndex] = useState<number | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);

  // Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<SessionGeneration | null>(null);
  const [outputImagesData, setOutputImagesData] = useState<string[]>([]);
  const [outputTexts, setOutputTexts] = useState<string[]>([]);

  const editingControlImage = editingControlIndex !== null
    ? controlImagesData[editingControlIndex]?.data ?? null
    : null;

  // API Key State
  const [apiKeyConnected, setApiKeyConnected] = useState(false);

  // Mixboard State
  const [mixboardSessions, setMixboardSessions] = useState<MixboardSession[]>([]);
  const [currentMixboardSessionId, setCurrentMixboardSessionId] = useState<string | null>(null);
  const mixboardSession = mixboardSessions.find(s => s.session_id === currentMixboardSessionId) || null;

  // Settings & Theme State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGraphView, setShowGraphView] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [userHistory, setUserHistory] = useState<UserHistory>(PreferencesService.defaultsHistory);
  const [hasHydratedSessions, setHasHydratedSessions] = useState(false);

  const historyItems = useMemo<HistoryGalleryItem[]>(() => {
    return sessions
      .flatMap(session =>
        session.generations.flatMap<HistoryGalleryItem>((generation) => {
          const outputs = generation.output_images || (generation.output_image ? [generation.output_image] : []);
          const texts = generation.output_texts || [];

          if (outputs.length === 0) {
            const textItem: HistoryGalleryItem = {
              kind: 'text',
              sessionId: session.session_id,
              sessionTitle: session.title,
              generation,
              texts
            };

            return [textItem];
          }

          const imageItems: HistoryGalleryItem[] = outputs.map((output, idx) => ({
            kind: 'image',
            sessionId: session.session_id,
            sessionTitle: session.title,
            generation,
            output,
            outputIndex: idx,
            texts
          }));

          return imageItems;
        })
      )
      .sort((a, b) => new Date(b.generation.timestamp).getTime() - new Date(a.generation.timestamp).getTime());
  }, [sessions]);

  // Get current session
  const currentSession = sessions.find(s => s.session_id === currentSessionId) || null;

  // --- EFFECTS ---
  useEffect(() => {
    LoggerService.init();
  }, []);

  useEffect(() => {
    const applySettings = (settings: UserSettings) => {
      setTheme(settings.theme);
      setShowHistory(settings.showHistory);
      setShowGraphView(settings.showGraphView);
    };

    let isCancelled = false;

    const hydratePreferences = async () => {
      const [settings, history] = await Promise.all([
        PreferencesService.loadSettings(),
        PreferencesService.loadHistory()
      ]);

      if (isCancelled) return;
      applySettings(settings);
      setUserHistory(history);
      setPreferencesReady(true);
    };

    hydratePreferences();

    PreferencesService.subscribeToCacheReady(({ settings, history }) => {
      if (isCancelled) return;
      applySettings(settings);
      setUserHistory(history);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editingControlIndex !== null && editingControlIndex >= controlImagesData.length) {
      setEditingControlIndex(null);
    }
  }, [controlImagesData.length, editingControlIndex]);

  useEffect(() => {
    LoggerService.setCurrentUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    GeminiService.checkApiKey().then(setApiKeyConnected);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    PreferencesService.saveSettings({ theme, showHistory, showGraphView }).catch((err) => {
      console.warn('Failed to persist user settings', err);
    });
  }, [preferencesReady, theme, showHistory, showGraphView]);

  useEffect(() => {
    if (!preferencesReady) return;
    PreferencesService.saveHistory({
      lastSessionId: currentSessionId,
      lastMixboardSessionId: currentMixboardSessionId
    })
      .then(setUserHistory)
      .catch((err) => console.warn('Failed to persist user history', err));
  }, [preferencesReady, currentSessionId, currentMixboardSessionId]);

  // Define handlers before they're used in callbacks
  // Note: Using regular functions (not useCallback) since they reference
  // loadGenerationIntoView and resetInputs which are also regular functions
  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    const session = StorageService.loadSession(id);
    if (!session) return;

    // If the session has generations, load the most recent one
    if (session.generations.length > 0) {
      const lastGen = session.generations[session.generations.length - 1];
      loadGenerationIntoView(lastGen, { includeInputs: false });
    } else {
        resetInputs();
    }
  };

  const handleNewSession = () => {
    const newSession = StorageService.createSession("New Session", currentUser || undefined);
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.session_id);
    resetInputs();
    LoggerService.logAction('Created new session', {
      sessionId: newSession.session_id,
      user: currentUser?.displayName
    });
  };

  const hydrateSessions = useCallback(async () => {
    if (!currentUser || hasHydratedSessions) return;

    setHasHydratedSessions(true);

    try {
      await StorageService.syncUserData?.();
    } catch (err) {
      console.error('Failed to sync user data to shared storage', err);
    }

    const allSessions = StorageService.getSessions();

    // Filter sessions to only show the current user's sessions
    const userSessions = currentUser
      ? allSessions.filter(s => s.user?.id === currentUser.id)
      : [];

    setSessions(userSessions);

    if (userSessions.length > 0) {
      const preferredSessionId = userHistory.lastSessionId && userSessions.find(
        (session) => session.session_id === userHistory.lastSessionId
      )?.session_id;

      const nextSessionId = preferredSessionId || userSessions[0].session_id;
      // Only select session if it's different from current to prevent infinite loop
      if (currentSessionId !== nextSessionId) {
        handleSelectSession(nextSessionId);
      }
    } else if (currentSessionId !== null) {
      // Only create new session if we don't already have one
      handleNewSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentSessionId, hasHydratedSessions, userHistory.lastSessionId]);

  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      setCurrentSessionId(null);
      setHasHydratedSessions(false);
      return;
    }

    const preferredSessionId = userHistory.lastSessionId;
    if (preferredSessionId) {
      const preferredSession = StorageService.loadSession(preferredSessionId);
      if (preferredSession && preferredSession.user?.id === currentUser.id) {
        setSessions([preferredSession]);
        // Only select if not already selected to prevent infinite loop
        if (currentSessionId !== preferredSession.session_id) {
          handleSelectSession(preferredSession.session_id);
        }
      }
    }

    if (!preferredSessionId && currentSessionId === null) {
      handleNewSession();
    }

    const idleHandle = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(() => hydrateSessions())
      : setTimeout(() => hydrateSessions(), 700);

    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof idleHandle === 'number') {
        (window as any).cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle as any);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentSessionId, hydrateSessions, userHistory.lastSessionId]);

  useEffect(() => {
    if ((showHistory || showGraphView) && !hasHydratedSessions) {
      hydrateSessions();
    }
  }, [hasHydratedSessions, hydrateSessions, showGraphView, showHistory]);

  // --- HANDLERS ---
  const handleLogin = (user: { displayName: string; id: string }, persist = true) => {
    // First, let UserContext process the user and get/create the persistent ID
    setCurrentUser(user, persist);

    // UserContext will update currentUser with the persistent ID via the mapping
    // We need to wait for that update before notifying LoggerService
    // The useEffect below will handle the LoggerService update
  };

  // Track previous user to detect login events
  const [previousUser, setPreviousUser] = useState<typeof currentUser>(null);

  // Update LoggerService whenever currentUser changes (after UserContext processes it)
  useEffect(() => {
    if (currentUser) {
      LoggerService.setCurrentUser(currentUser);

      // Log login event if this is a new login (user changed from null to a value)
      if (!previousUser) {
        LoggerService.logLogin('User logged in', {
          displayName: currentUser.displayName,
          userId: currentUser.id
        });
      }
      setPreviousUser(currentUser);
    } else {
      setPreviousUser(null);
    }
  }, [currentUser]);

  const handleLogout = () => {
    LoggerService.logAction('User logged out', { displayName: currentUser?.displayName });
    userLogout();
    // Close settings modal
    setIsSettingsOpen(false);
    // Reload the page to clear all state and return to welcome
    window.location.reload();
  };

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

  // --- MIXBOARD HANDLERS ---
  const handleMixboardSessionUpdate = (session: MixboardSession) => {
    // Update the session in the array
    setMixboardSessions(prev =>
      prev.map(s => s.session_id === session.session_id ? session : s)
    );
  };

  const handleCreateMixboardSession = (): MixboardSession => {
    const newSession: MixboardSession = {
      session_id: `mixboard-${Date.now()}`,
      title: `Mixboard ${new Date().toLocaleString()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      generations: [],
      canvas_images: [],
      user: currentUser || undefined
    };

    StorageService.saveSession(newSession as any);
    setMixboardSessions(prev => [...prev, newSession]);
    setCurrentMixboardSessionId(newSession.session_id);

    LoggerService.logAction('Created Mixboard session', {
      sessionId: newSession.session_id,
      user: currentUser?.displayName
    });

    return newSession;
  };

  const handleSelectMixboardSession = (sessionId: string) => {
    setCurrentMixboardSessionId(sessionId);
    console.log('[App] Switched to Mixboard session:', sessionId);
  };

  const loadMixboardSessions = () => {
    const allSessions = StorageService.getSessions();

    // Filter for Mixboard sessions (those with canvas_images property)
    const mixboardSessions = allSessions.filter(s =>
      'canvas_images' in s
    ) as MixboardSession[];

    // Filter by current user
    const userMixboardSessions = currentUser
      ? mixboardSessions.filter(s => s.user?.id === currentUser.id)
      : [];

    setMixboardSessions(userMixboardSessions);
    console.log('[App] Loaded Mixboard sessions:', userMixboardSessions.length);
  };

  // Load Mixboard sessions when user changes
  useEffect(() => {
    if (currentUser) {
      setCurrentMixboardSessionId(null);
      loadMixboardSessions();
    } else {
      setMixboardSessions([]);
      setCurrentMixboardSessionId(null);
    }
  }, [currentUser]);

  const handleRenameSession = (id: string, newTitle: string) => {
    StorageService.renameSession(id, newTitle);
    // Reload and filter sessions for current user
    const allSessions = StorageService.getSessions();
    const userSessions = currentUser
      ? allSessions.filter(s => s.user?.id === currentUser.id)
      : [];
    setSessions(userSessions);
  };

  const handleDeleteSession = (id: string) => {
    const session = sessions.find(s => s.session_id === id);
    if (!session) return;

    // Only allow deletion of empty sessions
    if (session.generations.length > 0) {
      alert('Cannot delete session with generations. Sessions with history are preserved.');
      return;
    }

    StorageService.deleteSession(id);
    // Reload and filter sessions for current user
    const allSessions = StorageService.getSessions();
    const userSessions = currentUser
      ? allSessions.filter(s => s.user?.id === currentUser.id)
      : [];
    setSessions(userSessions);

    // If we deleted the current session, switch to another one
    if (currentSessionId === id) {
      if (userSessions.length > 0) {
        handleSelectSession(userSessions[0].session_id);
      } else {
        handleNewSession();
      }
    }
  };

  const handleEditControlImage = (index: number) => {
    setEditingControlIndex(index);
  };

  const handleSaveEditedControl = (dataUri: string) => {
    setControlImagesData(prev =>
      prev.map((item, idx) => (idx === editingControlIndex ? { ...item, data: dataUri } : item))
    );
    setEditingControlIndex(null);
  };

  const handleCreateBlankControlImage = () => {
    // Create a blank white canvas (1024x1024)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Fill with white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert to base64 data URI
      const dataUri = canvas.toDataURL('image/png');

      const payload: UploadedImagePayload = {
        data: dataUri,
        original_name: 'blank_canvas.png',
        size_bytes: dataUri.length
      };

      setControlImagesData(prev => [...prev, payload]);
    }
  };

  const handleSelectGeneration = (sessionId: string, gen: SessionGeneration) => {
    const switchingSession = sessionId !== currentSessionId;

    if (switchingSession) {
      setCurrentSessionId(sessionId);
    }

    loadGenerationIntoView(gen, { includeInputs: !switchingSession });
  };

  const loadGenerationIntoView = (gen: SessionGeneration, options: { includeInputs?: boolean } = {}) => {
    const { includeInputs = true } = options;
    setPrompt(gen.prompt);
    setConfig(gen.parameters);
    setCurrentGeneration(gen);

    if (includeInputs) {
      // Load control images
      if (gen.control_images && gen.control_images.length > 0) {
        const imagesData = gen.control_images
          .map(img => StorageService.loadImage('control', img.id, img.filename))
          .filter(data => data !== null)
          .map(data => ({ data })) as UploadedImagePayload[];
        setControlImagesData(imagesData);
      } else {
        setControlImagesData([]);
      }

      // Load reference images
      if (gen.reference_images && gen.reference_images.length > 0) {
        const imagesData = gen.reference_images
          .map(img => StorageService.loadImage('reference', img.id, img.filename))
          .filter(data => data !== null)
          .map(data => ({ data })) as UploadedImagePayload[];
        setReferenceImagesData(imagesData);
      } else {
        setReferenceImagesData([]);
      }
    } else {
      setControlImagesData([]);
      setReferenceImagesData([]);
    }

    // Load output image(s)
    const outputs = gen.output_images || (gen.output_image ? [gen.output_image] : []);
    if (outputs.length > 0) {
      const imageData = outputs
        .map(img => StorageService.loadImage('output', img.id, img.filename))
        .filter(data => data !== null) as string[];
      setOutputImagesData(imageData);
    } else {
      setOutputImagesData([]);
    }

    setOutputTexts(gen.output_texts || []);
  };

  const resetInputs = () => {
    setPrompt("");
    setControlImagesData([]);
    setReferenceImagesData([]);
    setConfig(DEFAULT_CONFIG);
    setCurrentGeneration(null);
    setOutputImagesData([]);
    setOutputTexts([]);
  };

  const handleImageUpload = async (file: File, role: 'control' | 'reference') => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const payload: UploadedImagePayload = {
          data: base64,
          original_name: file.name,
          size_bytes: file.size
        };
        if (role === 'control') {
          setControlImagesData(prev => [...prev, payload]);
        } else {
          setReferenceImagesData(prev => [...prev, payload]);
        }
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryImageDrop = (payload: UploadedImagePayload, role: 'control' | 'reference') => {
    if (role === 'control') {
      setControlImagesData(prev => [...prev, payload]);
    } else {
      setReferenceImagesData(prev => [...prev, payload]);
    }
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
          if (isConnected) {
            LoggerService.logAction('API key connected');
          }
      } catch (e) {
          console.error("Failed to connect API Key", e);
          alert("Could not verify API Key selection.");
          LoggerService.logError('API key connection failed', { error: (e as Error).message });
      }
  };

  const handleApiKeyUpdate = async () => {
      const isConnected = await GeminiService.checkApiKey();
      setApiKeyConnected(isConnected);
  };

  const handleGenerate = async () => {
    if (!currentSessionId || !prompt) return;
    if (!currentUser) return;

    LoggerService.logAction('Generation started', {
      sessionId: currentSessionId,
      model: config.model,
      promptLength: prompt.length
    });

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
    setOutputImagesData([]);
    setOutputTexts([]);

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
        // 3. API Call (send all control/reference images when provided)
        const output = await GeminiService.generateImage(
            prompt,
            config,
            controlImagesData.length > 0 ? controlImagesData.map(img => img.data) : undefined,
            referenceImagesData.length > 0 ? referenceImagesData.map(img => img.data) : undefined,
            currentUser.displayName
        );

        const duration = Date.now() - startTime;

        // 4. Complete Generation and Save Output
        const outputDataUris = output.images.map(img => `data:image/png;base64,${img}`);
        StorageService.completeGeneration(
          currentSessionId,
          gen.generation_id,
          outputDataUris,
          duration,
          output.texts
        );

        // 5. Reload session and update UI
        const updatedSession = StorageService.loadSession(currentSessionId);
        if (updatedSession) {
          const completedGen = updatedSession.generations.find(g => g.generation_id === gen.generation_id);
          if (completedGen) {
            setCurrentGeneration(completedGen);
            const outputs = completedGen.output_images || (completedGen.output_image ? [completedGen.output_image] : []);
            if (outputs.length > 0) {
              const outputData = outputs
                .map(img => StorageService.loadImage('output', img.id, img.filename))
                .filter(data => data !== null) as string[];
              setOutputImagesData(outputData);
            }
            setOutputTexts(completedGen.output_texts || []);
          }
        }

        // Update sessions list to show new activity
        setSessions(StorageService.getSessions());

        LoggerService.logAction('Generation completed', {
          sessionId: currentSessionId,
          generationId: gen.generation_id,
          durationMs: duration
        });

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

        LoggerService.logError('Generation failed', {
          sessionId: currentSessionId,
          generationId: gen.generation_id,
          error: errorMessage
        });

        // Reload generation with error
        const updatedSession = StorageService.loadSession(currentSessionId);
        if (updatedSession) {
          const failedGen = updatedSession.generations.find(g => g.generation_id === gen.generation_id);
          if (failedGen) setCurrentGeneration(failedGen);
        }
    } finally {
        setIsGenerating(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-200 ${theme === 'dark' ? 'bg-black text-zinc-100' : 'bg-white text-zinc-900'}`}>

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
                {/* Mixboard (Main View) */}
                <button
                  onClick={() => {
                    setShowGraphView(false);
                    setShowHistory(false);
                  }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                    !showGraphView && !showHistory
                      ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-900 text-orange-700 dark:text-orange-400'
                      : 'bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Sparkles size={12} />
                  Mixboard
                </button>

                {/* Graph View Toggle */}
                <button
                  onClick={() => {
                    setShowGraphView(!showGraphView);
                    setShowHistory(false);
                  }}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                    showGraphView
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-900 text-purple-700 dark:text-purple-400'
                      : 'bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Network size={12} />
                  Graph View
                </button>

                {/* Gallery Toggle */}
                {(
                  <button
                    onClick={() => {
                      setShowHistory(!showHistory);
                      setShowGraphView(false);
                    }}
                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                      showHistory
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-900 text-blue-700 dark:text-blue-400'
                        : 'bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <History size={12} />
                    Gallery ({historyItems.length})
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
          <div className={`flex-1 ${showGraphView || showHistory ? 'overflow-y-auto p-6' : 'overflow-hidden'} bg-zinc-50 dark:bg-black/50`}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading workspace...</div>}>
              {showGraphView ? (
                <div className="h-full w-full">
                  <GraphView
                    sessions={sessions}
                    theme={theme}
                    loadImage={(role, id, filename) => StorageService.loadImage(role, id, filename)}
                  />
                </div>
              ) : showHistory ? (
                <div className="max-w-7xl mx-auto h-full min-h-[calc(100vh-6rem)]">
                  <HistoryPanel
                    items={historyItems}
                    onSelectGeneration={handleSelectGeneration}
                    selectedGenerationId={currentGeneration?.generation_id}
                    onExportImage={handleExportImage}
                    loadImage={(role, id, filename) => StorageService.loadImage(role, id, filename)}
                  />
                </div>
              ) : (
                <div className="h-full w-full">
                  <MixboardView
                    theme={theme}
                    toggleTheme={toggleTheme}
                    currentSession={mixboardSession}
                    allSessions={mixboardSessions}
                    onSessionUpdate={handleMixboardSessionUpdate}
                    onSelectSession={handleSelectMixboardSession}
                    onCreateSession={handleCreateMixboardSession}
                    currentUser={currentUser}
                  />
                </div>
              )}
            </Suspense>
          </div>
      </div>

      <Suspense fallback={null}>
        <ImageEditModal
          isOpen={editingControlIndex !== null}
          image={editingControlImage}
          onClose={() => setEditingControlIndex(null)}
          onSave={handleSaveEditedControl}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          toggleTheme={toggleTheme}
          onApiKeyUpdate={handleApiKeyUpdate}
          onLogout={handleLogout}
        />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}