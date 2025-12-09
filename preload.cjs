const { contextBridge, ipcRenderer } = require('electron');

const safeEnv = {
  sharedApiKey: process.env.VITE_SHARED_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY,
  logEndpoint: process.env.VITE_LOG_ENDPOINT
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

  // Thumbnail operations
  saveThumbnailSync: (sessionId, imageId, thumbnailBase64) => ipcRenderer.sendSync('save-thumbnail-sync', sessionId, imageId, thumbnailBase64),
  loadThumbnailSync: (thumbnailPath) => ipcRenderer.sendSync('load-thumbnail-sync', thumbnailPath),
  deleteThumbnailSync: (thumbnailPath) => ipcRenderer.sendSync('delete-thumbnail-sync', thumbnailPath),

  // Session operations
  listSessionsSync: () => ipcRenderer.sendSync('list-sessions-sync'),
  saveSessionSync: (sessionId, sessionData) => ipcRenderer.sendSync('save-session-sync', sessionId, sessionData),
  saveSession: (sessionId, sessionData) => ipcRenderer.invoke('save-session', sessionId, sessionData),
  loadSessionSync: (sessionId) => ipcRenderer.sendSync('load-session-sync', sessionId),
  deleteSessionSync: (sessionId) => ipcRenderer.sendSync('delete-session-sync', sessionId),
  renameSessionFileSync: (sessionId, newExtension) => ipcRenderer.sendSync('rename-session-file-sync', sessionId, newExtension),
  syncUserData: () => ipcRenderer.invoke('sync-user-data'),

  // Logging
  logEvent: (entry) => ipcRenderer.sendSync('log-event', entry),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
  appendLog: (line) => ipcRenderer.sendSync('append-log', line),
  setUserContext: (user) => ipcRenderer.send('set-user-context', user),
  loadUserSettings: () => ipcRenderer.invoke('user-settings:get'),
  saveUserSettings: (settings) => ipcRenderer.invoke('user-settings:save', settings),
  loadUserHistory: () => ipcRenderer.invoke('user-history:get'),
  saveUserHistory: (history) => ipcRenderer.invoke('user-history:save', history),
  onUserCacheReady: (callback) => ipcRenderer.on('user-cache-ready', (_event, payload) => callback(payload)),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
});

contextBridge.exposeInMainWorld('env', safeEnv);
