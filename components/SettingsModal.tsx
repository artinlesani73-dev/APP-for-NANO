import React, { useRef, useState, useEffect } from 'react';
import { X, Moon, Sun, Download, Upload, Monitor, Folder, Key, LogOut, Clock, Save } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onApiKeyUpdate?: () => void;
  onLogout?: () => void;
  autoSaveInterval?: number;
  onAutoSaveIntervalChange?: (interval: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  toggleTheme,
  onApiKeyUpdate,
  onLogout,
  autoSaveInterval = 5,
  onAutoSaveIntervalChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isElectron = StorageService.isElectron();
  const [apiKey, setApiKey] = useState('');
  const [localAutoSaveInterval, setLocalAutoSaveInterval] = useState(autoSaveInterval);

  // Sync local state when prop changes
  useEffect(() => {
    setLocalAutoSaveInterval(autoSaveInterval);
  }, [autoSaveInterval]);

  const handleAutoSaveChange = (value: number) => {
    setLocalAutoSaveInterval(value);
    // Persist to localStorage
    localStorage.setItem('autosave_interval', String(value));
    // Notify parent
    onAutoSaveIntervalChange?.(value);
  };

  useEffect(() => {
    if (isOpen && isElectron) {
      const savedKey = localStorage.getItem('gemini_api_key') || '';
      setApiKey(savedKey);
    }
  }, [isOpen, isElectron]);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      alert('API key saved successfully!');
      onApiKeyUpdate?.();
    } else {
      localStorage.removeItem('gemini_api_key');
      alert('API key removed.');
      onApiKeyUpdate?.();
    }
  };

  if (!isOpen) return null;

  const handleExport = () => {
    const data = StorageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `provenance-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const success = StorageService.importData(text);
      if (success) {
        alert("Data imported successfully! The page will reload.");
        window.location.reload();
      } else {
        alert("Failed to import data. Invalid format.");
      }
    } catch (err) {
      alert("Error parsing file.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-xl shadow-2xl border ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-100'}`}>
          <h2 className="font-semibold text-lg">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* API Key Configuration (Electron Only) */}
          {isElectron && (
            <section className="space-y-3">
              <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider`}>Google AI API Key</h3>
              <div className={`p-4 rounded-lg border space-y-3 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex items-start gap-3">
                  <Key size={18} className="mt-0.5 text-blue-500" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Gemini API Key</h4>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>
                      Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    className={`w-full px-3 py-2 rounded-md text-sm font-mono border ${
                      theme === 'dark'
                        ? 'bg-zinc-900 border-zinc-700 focus:border-blue-500'
                        : 'bg-white border-zinc-300 focus:border-blue-500'
                    } outline-none transition-colors`}
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Save API Key
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Appearance */}
          <section className="space-y-3">
            <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider`}>Appearance</h3>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                <span className="text-sm font-medium">Interface Theme</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                    : 'bg-white border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </section>

          {/* Auto-Save Settings */}
          <section className="space-y-3">
            <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider`}>Auto-Save</h3>
            <div className={`p-4 rounded-lg border space-y-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="flex items-start gap-3">
                <Clock size={18} className="mt-0.5 text-blue-500" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Auto-Save Interval</h4>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>
                    Automatically save your canvas at regular intervals. Set to 0 to disable.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={localAutoSaveInterval}
                    onChange={(e) => handleAutoSaveChange(Number(e.target.value))}
                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-zinc-300 dark:bg-zinc-700"
                  />
                  <span className={`text-sm font-mono w-16 text-right ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {localAutoSaveInterval === 0 ? 'Off' : `${localAutoSaveInterval} min`}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Disabled</span>
                  <span>30 min</span>
                </div>
              </div>

              <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>
                <Save size={14} />
                <span>
                  {localAutoSaveInterval === 0
                    ? 'Auto-save is disabled. Use Ctrl+S to save manually.'
                    : `Canvas will be saved every ${localAutoSaveInterval} minute${localAutoSaveInterval > 1 ? 's' : ''} when changes are detected.`
                  }
                </span>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section className="space-y-3">
            <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider`}>Data Management</h3>
            <div className={`p-4 rounded-lg border space-y-4 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
               
               {/* Location Info */}
               <div className="flex items-start gap-3">
                  {isElectron ? <Folder size={18} className="mt-0.5 text-blue-500" /> : <Monitor size={18} className="mt-0.5 text-blue-500" />}
                  <div>
                    <h4 className="text-sm font-medium">{isElectron ? "Local File System" : "Browser Storage"}</h4>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>
                      {isElectron 
                        ? "Your data is automatically saved to 'Documents/ImageProvenanceStudio' as JSON files." 
                        : "Data is saved in your browser's local storage. Clear your cache to reset."}
                    </p>
                  </div>
               </div>

               {/* Backup Actions (Web Only or Manual Backup for Desktop) */}
               {!isElectron && (
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={handleExport}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                    >
                        <Download size={14} />
                        Export JSON
                    </button>
                    <button 
                        onClick={handleImportClick}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded text-xs font-medium transition-colors ${
                        theme === 'dark' 
                        ? 'border-zinc-700 hover:bg-zinc-800' 
                        : 'border-zinc-300 hover:bg-zinc-100 bg-white'
                        }`}
                    >
                        <Upload size={14} />
                        Import JSON
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json"
                        onChange={handleFileChange}
                    />
                </div>
               )}
            </div>
          </section>

          {/* Account Section */}
          {onLogout && (
            <section className="space-y-3">
              <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider`}>Account</h3>
              <button
                onClick={onLogout}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-red-950/20 border-red-900/50 hover:bg-red-950/30 text-red-400'
                    : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'
                } font-medium text-sm`}
              >
                <LogOut size={16} />
                Log Out
              </button>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className={`p-4 border-t text-center text-xs ${theme === 'dark' ? 'border-zinc-800 text-zinc-500' : 'border-zinc-100 text-zinc-400'}`}>
          AREA49 - Nano Banana UI v1.0 • Created by Artin Lesani
        </div>
      </div>
    </div>
  );
};