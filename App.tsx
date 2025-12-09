import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import type { HistoryGalleryItem } from './components/HistoryPanel';
import { LoginForm } from './components/LoginForm';
import { UserProvider, useUser } from './components/UserContext';
import { StorageServiceV2 } from './services/storageV2';
import { GeminiService } from './services/geminiService';
import { LoggerService } from './services/logger';
import { PreferencesService, type UserHistory, type UserSettings } from './services/preferencesService';
import { MixboardSession } from './types';
import { Database, Key } from 'lucide-react';
import { ViewSidebar } from './components/ViewSidebar';

const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(module => ({ default: module.HistoryPanel })));
const GraphView = lazy(() => import('./components/GraphView'));
const MixboardView = lazy(() => import('./components/MixboardView').then(module => ({ default: module.MixboardView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));

function AppContent() {
  // --- STATE ---
  const { currentUser, setCurrentUser, logout: userLogout } = useUser();

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

  const historyItems = useMemo<HistoryGalleryItem[]>(() => {
    if (!Array.isArray(mixboardSessions) || mixboardSessions.length === 0) {
      return [];
    }

    return mixboardSessions
      .flatMap(session => {
        if (!session || !session.generations || !Array.isArray(session.generations)) {
          return [];
        }
        return session.generations.flatMap<HistoryGalleryItem>((generation) => {
          const outputs = generation.output_images || [];
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
        });
      })
      .flat()
      .sort((a, b) => new Date(b.generation.timestamp).getTime() - new Date(a.generation.timestamp).getTime());
  }, [mixboardSessions]);

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
      lastSessionId: null,
      lastMixboardSessionId: currentMixboardSessionId
    })
      .then(setUserHistory)
      .catch((err) => console.warn('Failed to persist user history', err));
  }, [preferencesReady, currentMixboardSessionId]);


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
    const newSession = StorageServiceV2.createSession(
      `Mixboard ${new Date().toLocaleString()}`,
      currentUser || undefined
    );

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
    // Get all session metadata from V2 storage
    const allMetadata = StorageServiceV2.listSessions();

    // Filter by current user
    const userMetadata = currentUser
      ? allMetadata.filter(m => m.user?.id === currentUser.id)
      : [];

    // Load full session data for each
    const userMixboardSessions = userMetadata
      .map(meta => StorageServiceV2.loadSession(meta.session_id))
      .filter((s): s is MixboardSession => s !== null);

    setMixboardSessions(userMixboardSessions);
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

  // Reload sessions when switching to History or Graph view to ensure fresh data
  useEffect(() => {
    if ((showHistory || showGraphView) && currentUser) {
      loadMixboardSessions();
    }
  }, [showHistory, showGraphView]);



  // Load image using Storage V2 hash-based system
  const loadImage = (role: 'control' | 'reference' | 'output', id: string, filename: string, thumbnailPath?: string): string | null => {
    // Try loading thumbnail first for better performance in History/Graph views
    if (thumbnailPath) {
      const thumbnail = StorageServiceV2.loadThumbnailByPath(thumbnailPath);
      if (thumbnail) return thumbnail;
    }

    // Fall back to full-size image
    return StorageServiceV2.loadImageByHash(id);
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


  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-200 ${theme === 'dark' ? 'bg-black text-zinc-100' : 'bg-white text-zinc-900'}`}>

      {/* LEFT SIDEBAR */}
      <ViewSidebar
        showGraphView={showGraphView}
        showHistory={showHistory}
        historyCount={historyItems.length}
        onToggleGraphView={() => {
          setShowGraphView(!showGraphView);
          setShowHistory(false);
        }}
        onToggleHistory={() => {
          setShowHistory(!showHistory);
          setShowGraphView(false);
        }}
        onToggleMixboard={() => {
          setShowGraphView(false);
          setShowHistory(false);
        }}
        theme={theme}
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
                  {StorageServiceV2.isElectron() ? "DESKTOP" : "WEB PREVIEW"}
                </span>
            </div>

            <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {!apiKeyConnected && (
                    <button
                        onClick={handleConnectApiKey}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors font-medium text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 shadow-sm"
                        title="Connect Google AI Studio"
                    >
                        <Key size={12} />
                        Connect Google AI Studio
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
                    sessions={mixboardSessions}
                    theme={theme}
                    loadImage={loadImage}
                  />
                </div>
              ) : showHistory ? (
                <div className="max-w-7xl mx-auto h-full min-h-[calc(100vh-6rem)]">
                  <HistoryPanel
                    items={historyItems}
                    onSelectGeneration={() => {}}
                    selectedGenerationId={undefined}
                    onExportImage={() => {}}
                    loadImage={loadImage}
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