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

  // Image operations
  saveImageSync: (folder, filename, base64Data) => ipcRenderer.sendSync('save-image-sync', folder, filename, base64Data),
  saveInputImageSync: (originalName, sizeBytes, base64Data) => ipcRenderer.sendSync('save-input-image-sync', originalName, sizeBytes, base64Data),
  loadImageSync: (folder, filename) => ipcRenderer.sendSync('load-image-sync', folder, filename),
  exportImageSync: (folder, filename) => ipcRenderer.sendSync('export-image-sync', folder, filename),

  // Session operations
  listSessionsSync: () => ipcRenderer.sendSync('list-sessions-sync'),
  saveSessionSync: (sessionId, sessionData) => ipcRenderer.sendSync('save-session-sync', sessionId, sessionData),
  loadSessionSync: (sessionId) => ipcRenderer.sendSync('load-session-sync', sessionId),
  deleteSessionSync: (sessionId) => ipcRenderer.sendSync('delete-session-sync', sessionId),

  // Logging
  logEvent: (entry) => ipcRenderer.sendSync('log-event', entry),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
  verifyAdminPassphrase: (passphrase) => ipcRenderer.invoke('verify-admin-passphrase', passphrase),
  openAdminWindow: (verified) => ipcRenderer.invoke('open-admin-window', verified),
  getAdminMetrics: () => ipcRenderer.invoke('get-admin-metrics'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
});

contextBridge.exposeInMainWorld('env', safeEnv);
