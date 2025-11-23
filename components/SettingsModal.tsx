import React, { useRef } from 'react';
import { X, Moon, Sun, Download, Upload, Monitor, Folder } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  theme, 
  toggleTheme 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isElectron = StorageService.isElectron();

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
          
        </div>

        {/* Footer */}
        <div className={`p-4 border-t text-center text-xs ${theme === 'dark' ? 'border-zinc-800 text-zinc-500' : 'border-zinc-100 text-zinc-400'}`}>
          Image Provenance Studio v1.2 • {isElectron ? "Desktop Edition" : "Web Edition"}
        </div>
      </div>
    </div>
  );
};