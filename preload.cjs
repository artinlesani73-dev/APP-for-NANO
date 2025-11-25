const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveSync: (filename, content) => ipcRenderer.sendSync('save-sync', filename, content),
  loadSync: (filename) => ipcRenderer.sendSync('load-sync', filename),
  deleteSync: (filename) => ipcRenderer.sendSync('delete-sync', filename),
  listFilesSync: (prefix) => ipcRenderer.sendSync('list-files-sync', prefix),

  // Image operations
  saveImageSync: (folder, filename, base64Data) => ipcRenderer.sendSync('save-image-sync', folder, filename, base64Data),
  loadImageSync: (folder, filename) => ipcRenderer.sendSync('load-image-sync', folder, filename),
  exportImageSync: (folder, filename) => ipcRenderer.sendSync('export-image-sync', folder, filename),

  // Session operations
  listSessionsSync: () => ipcRenderer.sendSync('list-sessions-sync'),
  saveSessionSync: (sessionId, sessionData) => ipcRenderer.sendSync('save-session-sync', sessionId, sessionData),
  loadSessionSync: (sessionId) => ipcRenderer.sendSync('load-session-sync', sessionId),
  deleteSessionSync: (sessionId) => ipcRenderer.sendSync('delete-session-sync', sessionId),

  // Logging
  logEvent: (entry) => ipcRenderer.sendSync('log-event', entry),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs')
});
