const { contextBridge, ipcRenderer } = require('electron');

const safeEnv = {
  sharedApiKey: process.env.VITE_SHARED_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY,
  logEndpoint: process.env.VITE_LOG_ENDPOINT,
  adminPassphrase: process.env.VITE_ADMIN_PASSPHRASE
};

contextBridge.exposeInMainWorld('electron', {
  saveSync: (filename, content) => ipcRenderer.sendSync('save-sync', filename, content),
  loadSync: (filename) => ipcRenderer.sendSync('load-sync', filename),
  deleteSync: (filename) => ipcRenderer.sendSync('delete-sync', filename),
  listFilesSync: (prefix) => ipcRenderer.sendSync('list-files-sync', prefix),
  logEvent: (entry) => ipcRenderer.sendSync('log-event', entry),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  verifyAdminPassphrase: (passphrase) => ipcRenderer.invoke('verify-admin-passphrase', passphrase),
  openAdminWindow: (verified) => ipcRenderer.invoke('open-admin-window', verified),
  getAdminMetrics: () => ipcRenderer.invoke('get-admin-metrics'),
  loadUserSettings: () => ipcRenderer.invoke('user-settings:get'),
  saveUserSettings: (settings) => ipcRenderer.invoke('user-settings:save', settings),
  loadUserHistory: () => ipcRenderer.invoke('user-history:get'),
  saveUserHistory: (history) => ipcRenderer.invoke('user-history:save', history),
  onUserCacheReady: (callback) => ipcRenderer.on('user-cache-ready', (_event, payload) => callback(payload)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
});

contextBridge.exposeInMainWorld('env', safeEnv);