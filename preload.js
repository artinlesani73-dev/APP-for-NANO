const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveSync: (filename, content) => ipcRenderer.sendSync('save-sync', filename, content),
  loadSync: (filename) => ipcRenderer.sendSync('load-sync', filename),
  deleteSync: (filename) => ipcRenderer.sendSync('delete-sync', filename),
  listFilesSync: (prefix) => ipcRenderer.sendSync('list-files-sync', prefix),
  logEvent: (entry) => ipcRenderer.sendSync('log-event', entry),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, error) => callback(error)),
});