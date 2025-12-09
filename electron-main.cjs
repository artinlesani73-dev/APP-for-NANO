const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const resolveAppIcon = () => {
  const candidatePaths = [
    path.join(__dirname, 'build', 'Area49_logo_A49-2024-3.ico'),
    app.getAppPath && path.join(app.getAppPath(), 'build', 'Area49_logo_A49-2024-3.ico'),
    process.resourcesPath && path.join(process.resourcesPath, 'build', 'Area49_logo_A49-2024-3.ico'),
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'Area49_logo_A49-2024-3.ico')
  ].filter(Boolean);

  const resolvedPath = candidatePaths.find(candidate => fs.existsSync(candidate));
  if (!resolvedPath) return undefined;

  const icon = nativeImage.createFromPath(resolvedPath);
  return icon.isEmpty() ? undefined : icon;
};

// Explicitly set the application user model ID so Windows uses the packaged
// executable's icon for taskbar entries instead of the default Electron icon.
app.setAppUserModelId('com.area49.nanobanana');

const loadDotEnv = () => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
};

loadDotEnv();

let mainWindow;
let currentUserContext = { displayName: 'anonymous', id: 'anonymous' };

const DEFAULT_SHARE_PATH = '\\\\192.168.1.2\\area49\\AREA49 AI UI\\';

const sanitizeSegment = (segment = '') =>
  segment
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    || 'anonymous';

const getUserFolderName = () => {
  const name = sanitizeSegment(currentUserContext.displayName);
  const id = sanitizeSegment(currentUserContext.id);
  return `${name}_${id}`;
};

function createWindow() {
  const icon = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
        color: '#18181b',
        symbolColor: '#e4e4e7',
        height: 40
    }
  });

  // Load from the 'dist' directory created by Vite build
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

const sendUpdateStatus = (channel, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
};

const ensureSubdirectories = (basePath) => {
    const subDirs = ['outputs', 'inputs', 'sessions'];
    subDirs.forEach(dir => {
        const dirPath = path.join(basePath, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
};

// Ensure data directory exists (local, user-scoped)
const getDataPath = () => {
    const userDataPath = app.getPath('documents');
    const appDir = path.join(userDataPath, 'ImageProvenanceStudio');
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
    }

    const userDir = path.join(appDir, 'users', getUserFolderName());
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    ensureSubdirectories(userDir);
    return userDir;
};

const getSharedDataPath = () => {
    const configured = process.env.LOG_SHARE_PATH || process.env.VITE_LOG_SHARE_PATH || DEFAULT_SHARE_PATH;
    const normalized = path.isAbsolute(configured) ? configured : path.resolve(configured);

    try {
        if (!fs.existsSync(normalized)) {
            fs.mkdirSync(normalized, { recursive: true });
        }

        const userDir = path.join(normalized, getUserFolderName());
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        ensureSubdirectories(userDir);
        return userDir;
    } catch (e) {
        console.error('Shared data path unavailable; continuing with local storage only', e);
        return null;
    }
};

const syncLocalToShared = () => {
    const sharedBase = getSharedDataPath();
    if (!sharedBase) {
        return { success: false, error: 'Shared storage unavailable' };
    }

    const localBase = getDataPath();
    try {
        fs.cpSync(localBase, sharedBase, { recursive: true, force: true });
        return { success: true, sharedPath: sharedBase };
    } catch (e) {
        console.error('Failed to sync local data to shared storage', e);
        return { success: false, error: e.message };
    }
};

const getScopedPath = (relativePath) => {
    const localBase = getDataPath();
    const sharedBase = getSharedDataPath();

    return {
        local: path.join(localBase, relativePath),
        shared: sharedBase ? path.join(sharedBase, relativePath) : null
    };
};

const writeFileBoth = (relativePath, data, options = undefined) => {
    const { local, shared } = getScopedPath(relativePath);
    const localDir = path.dirname(local);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(local, data, options);

    if (shared) {
        try {
            const sharedDir = path.dirname(shared);
            if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
            fs.writeFileSync(shared, data, options);
        } catch (e) {
            console.error('Failed to write to shared storage', e);
        }
    }

    return local;
};

const getLogFilePaths = () => getScopedPath('logs.json');

const getInputLogFilePath = () => getScopedPath('input-image-log.json');

const readInputLog = () => {
    const { local } = getInputLogFilePath();
    if (!fs.existsSync(local)) {
        return [];
    }
    try {
        const content = fs.readFileSync(local, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to read input image log', e);
        return [];
    }
};

const writeInputLog = (entries) => {
    writeFileBoth('input-image-log.json', JSON.stringify(entries, null, 2));
};

const readLogs = () => {
    const { local } = getLogFilePaths();
    if (!fs.existsSync(local)) {
        return [];
    }
    try {
        const content = fs.readFileSync(local, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to read logs', e);
        return [];
    }
};

const appendLog = (entry) => {
    const logs = readLogs();
    logs.push(entry);
    writeFileBoth('logs.json', JSON.stringify(logs, null, 2));
};

const logAutoUpdateEvent = (event, details) => {
  appendLog({
    type: 'auto-update',
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

// IPC Handlers for synchronous file operations
ipcMain.on('save-sync', (event, filename, content) => {
    try {
        // Don't add .json if filename already has it
        const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        writeFileBoth(finalFilename, content, 'utf-8');
        event.returnValue = true;
    } catch (e) {
        console.error("Save failed", e);
        event.returnValue = false;
    }
});

ipcMain.on('load-sync', (event, filename) => {
    try {
        // Don't add .json if filename already has it
        const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        const filePath = path.join(getDataPath(), finalFilename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            event.returnValue = content;
        } else {
            event.returnValue = null;
        }
    } catch (e) {
        event.returnValue = null;
    }
});

ipcMain.on('delete-sync', (event, filename) => {
    try {
        const filePath = path.join(getDataPath(), `${filename}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        event.returnValue = true;
    } catch (e) {
        event.returnValue = false;
    }
});

ipcMain.on('list-files-sync', (event, prefix) => {
    try {
        const dataDir = getDataPath();

        // If prefix ends with '/', it's a directory path - list files in that directory
        if (prefix.endsWith('/')) {
            const targetDir = path.join(dataDir, prefix);

            // Ensure directory exists
            if (!fs.existsSync(targetDir)) {
                console.log('[list-files-sync] Directory does not exist:', targetDir);
                event.returnValue = [];
                return;
            }

            const files = fs.readdirSync(targetDir);
            console.log('[list-files-sync] Files in', prefix, ':', files.length);
            event.returnValue = files;
        } else {
            // Legacy behavior: filter by prefix in root directory
            const files = fs.readdirSync(dataDir);
            const results = [];

            files.forEach(file => {
                if (file.startsWith(prefix) && file.endsWith('.json')) {
                    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
                    results.push({ key: file.replace('.json', ''), content });
                }
            });
            event.returnValue = results;
        }
    } catch (e) {
        console.error('[list-files-sync] Error:', e);
        event.returnValue = [];
    }
});

ipcMain.on('log-event', (event, entry) => {
    try {
        appendLog(entry);
        event.returnValue = true;
    } catch (e) {
        console.error('Failed to write log entry', e);
        event.returnValue = false;
    }
});

ipcMain.on('set-user-context', (_event, user) => {
    currentUserContext = {
        displayName: user?.displayName || 'anonymous',
        id: user?.id || 'anonymous'
    };

    syncLocalToShared();
});

ipcMain.handle('fetch-logs', async () => {
    return readLogs();
});

// Append-only log handler (for JSONL format in StorageV2)
ipcMain.on('append-log', (event, line) => {
    try {
        const local = path.join(getUserDataDir(), 'logs.jsonl');
        fs.appendFileSync(local, line, 'utf-8');
        event.returnValue = true;
    } catch (e) {
        console.error('Failed to append log line', e);
        event.returnValue = false;
    }
});

ipcMain.handle('sync-user-data', async () => {
    return syncLocalToShared();
});

ipcMain.handle('check-for-updates', async () => {
  logAutoUpdateEvent('check-for-updates');
  const result = await autoUpdater.checkForUpdates();
  logAutoUpdateEvent('check-for-updates-result', { versionInfo: result?.updateInfo });
  return result;
});

autoUpdater.on('update-available', (info) => {
  logAutoUpdateEvent('update-available', info);
  sendUpdateStatus('update-available', info);
});

autoUpdater.on('download-progress', (progress) => {
  logAutoUpdateEvent('download-progress', progress);
  sendUpdateStatus('update-download-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  logAutoUpdateEvent('update-downloaded', info);
  sendUpdateStatus('update-downloaded', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart and Install', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart to apply the update?',
  }).then(({ response }) => {
    if (response === 0) {
      logAutoUpdateEvent('quit-and-install');
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (error) => {
  logAutoUpdateEvent('error', { message: error?.message ?? String(error) });
  sendUpdateStatus('update-error', error?.message ?? String(error));
});

const hashBase64 = (base64) => crypto.createHash('sha256').update(base64).digest('hex');

// Save input image file with deduplication by name and size
ipcMain.on('save-input-image-sync', (event, originalName, sizeBytes, base64Data) => {
    try {
        const dataPath = getDataPath();
        const inputsDir = path.join(dataPath, 'inputs');
        const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

        const logEntries = readInputLog();
        const existing = logEntries.find(entry => entry.original_name === originalName && entry.size_bytes === sizeBytes);

        const ext = path.extname(originalName) || '.png';
        const baseName = path.basename(originalName, ext) || 'input';

        if (existing) {
            const existingPath = path.join(inputsDir, existing.filename);
            if (!fs.existsSync(existingPath)) {
                const buffer = Buffer.from(rawBase64, 'base64');
                writeFileBoth(path.join('inputs', existing.filename), buffer);
            }
            event.returnValue = { success: true, ...existing };
            return;
        }

        const id = crypto.randomUUID();
        const filename = `${baseName}_${id}${ext}`;
        const buffer = Buffer.from(rawBase64, 'base64');
        writeFileBoth(path.join('inputs', filename), buffer);

        const record = {
            id,
            filename,
            hash: hashBase64(rawBase64),
            original_name: originalName,
            size_bytes: sizeBytes
        };

        logEntries.push(record);
        writeInputLog(logEntries);
        event.returnValue = { success: true, ...record };
    } catch (e) {
        console.error('Save input image failed', e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Save image file to specific folder
ipcMain.on('save-image-sync', (event, folder, filename, base64Data) => {
    try {
        const dataPath = getDataPath();
        const imagePath = path.join(dataPath, folder, filename);

        // Remove base64 header if present
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        writeFileBoth(path.join(folder, filename), buffer);
        event.returnValue = { success: true, path: imagePath };
    } catch (e) {
        console.error("Save image failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Load image file from folder
ipcMain.on('load-image-sync', (event, folder, filename) => {
    try {
        const dataPath = getDataPath();
        const imagePath = path.join(dataPath, folder, filename);

        if (fs.existsSync(imagePath)) {
            const buffer = fs.readFileSync(imagePath);
            const base64 = buffer.toString('base64');
            const ext = path.extname(filename).slice(1);
            event.returnValue = `data:image/${ext};base64,${base64}`;
        } else {
            event.returnValue = null;
        }
    } catch (e) {
        console.error("Load image failed", e);
        event.returnValue = null;
    }
});

// Export/download a single image with save dialog
ipcMain.on('export-image-sync', (event, folder, filename) => {
    try {
        const dataPath = getDataPath();
        const sourcePath = path.join(dataPath, folder, filename);

        if (!fs.existsSync(sourcePath)) {
            event.returnValue = { success: false, error: 'File not found' };
            return;
        }

        // Show save dialog
        const result = dialog.showSaveDialogSync({
            title: 'Export Image',
            defaultPath: path.join(app.getPath('downloads'), filename),
            filters: [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result) {
            // User selected a path
            fs.copyFileSync(sourcePath, result);
            event.returnValue = { success: true, path: result };
        } else {
            // User cancelled
            event.returnValue = { success: false, cancelled: true };
        }
    } catch (e) {
        console.error("Export image failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Save thumbnail to disk
ipcMain.on('save-thumbnail-sync', (event, sessionId, imageId, thumbnailBase64) => {
    try {
        const dataPath = getDataPath();
        const thumbnailsDir = path.join(dataPath, 'thumbnails', sessionId);

        // Create thumbnails directory if it doesn't exist
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }

        const thumbnailPath = path.join(thumbnailsDir, `${imageId}.jpg`);

        // Remove data URI header if present
        const base64Data = thumbnailBase64.includes(',')
            ? thumbnailBase64.split(',')[1]
            : thumbnailBase64;

        // Write thumbnail to disk
        fs.writeFileSync(thumbnailPath, Buffer.from(base64Data, 'base64'));

        // Return relative path for storage in session
        const relativePath = path.join('thumbnails', sessionId, `${imageId}.jpg`);
        event.returnValue = { success: true, path: relativePath };
    } catch (e) {
        console.error("Save thumbnail failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Load thumbnail from disk
ipcMain.on('load-thumbnail-sync', (event, thumbnailPath) => {
    try {
        const dataPath = getDataPath();
        const fullPath = path.join(dataPath, thumbnailPath);

        if (fs.existsSync(fullPath)) {
            const buffer = fs.readFileSync(fullPath);
            const base64 = buffer.toString('base64');
            // Return as data URI
            event.returnValue = `data:image/jpeg;base64,${base64}`;
        } else {
            event.returnValue = null;
        }
    } catch (e) {
        console.error("Load thumbnail failed", e);
        event.returnValue = null;
    }
});

// Delete thumbnail from disk
ipcMain.on('delete-thumbnail-sync', (event, thumbnailPath) => {
    try {
        const dataPath = getDataPath();
        const fullPath = path.join(dataPath, thumbnailPath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
        event.returnValue = { success: true };
    } catch (e) {
        console.error("Delete thumbnail failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// List all sessions
ipcMain.on('list-sessions-sync', (event) => {
    try {
        const dataPath = getDataPath();
        const sessionsDir = path.join(dataPath, 'sessions');
        const files = fs.readdirSync(sessionsDir);
        const sessions = [];

        files.forEach(file => {
            // Skip legacy session files (renamed after migration)
            if (file.endsWith('.json') && !file.endsWith('.legacy.json')) {
                const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
                sessions.push(JSON.parse(content));
            }
        });

        event.returnValue = sessions;
    } catch (e) {
        console.error("List sessions failed", e);
        event.returnValue = [];
    }
});

// Save session file
ipcMain.on('save-session-sync', (event, sessionId, sessionData) => {
    try {
        writeFileBoth(path.join('sessions', `${sessionId}.json`), JSON.stringify(sessionData, null, 2));
        event.returnValue = { success: true };
    } catch (e) {
        console.error("Save session failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Async version of save-session (non-blocking)
ipcMain.handle('save-session', async (event, sessionId, sessionData) => {
    try {
        writeFileBoth(path.join('sessions', `${sessionId}.json`), JSON.stringify(sessionData, null, 2));
        return { success: true };
    } catch (e) {
        console.error("Save session failed", e);
        return { success: false, error: e.message };
    }
});

// Load session file
ipcMain.on('load-session-sync', (event, sessionId) => {
    try {
        const dataPath = getDataPath();
        const sessionPath = path.join(dataPath, 'sessions', `${sessionId}.json`);

        if (fs.existsSync(sessionPath)) {
            const content = fs.readFileSync(sessionPath, 'utf-8');
            event.returnValue = JSON.parse(content);
        } else {
            event.returnValue = null;
        }
    } catch (e) {
        console.error("Load session failed", e);
        event.returnValue = null;
    }
});

// Delete session file
ipcMain.on('delete-session-sync', (event, sessionId) => {
    try {
        const dataPath = getDataPath();
        const sessionPath = path.join(dataPath, 'sessions', `${sessionId}.json`);

        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
        }

        const sharedBase = getSharedDataPath();
        if (sharedBase) {
            const sharedSessionPath = path.join(sharedBase, 'sessions', `${sessionId}.json`);
            if (fs.existsSync(sharedSessionPath)) {
                fs.unlinkSync(sharedSessionPath);
            }
        }
        event.returnValue = { success: true };
    } catch (e) {
        console.error("Delete session failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// Rename session file (used for legacy migration)
ipcMain.on('rename-session-file-sync', (event, sessionId, newExtension) => {
    try {
        const dataPath = getDataPath();
        const oldPath = path.join(dataPath, 'sessions', `${sessionId}.json`);
        const newPath = path.join(dataPath, 'sessions', `${sessionId}${newExtension}`);

        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
        }

        // Also rename in shared storage if available
        const sharedBase = getSharedDataPath();
        if (sharedBase) {
            const sharedOldPath = path.join(sharedBase, 'sessions', `${sessionId}.json`);
            const sharedNewPath = path.join(sharedBase, 'sessions', `${sessionId}${newExtension}`);
            if (fs.existsSync(sharedOldPath)) {
                fs.renameSync(sharedOldPath, sharedNewPath);
            }
        }

        event.returnValue = { success: true };
    } catch (e) {
        console.error("Rename session file failed", e);
        event.returnValue = { success: false, error: e.message };
    }
});

// User Settings handlers
ipcMain.handle('user-settings:get', async () => {
    try {
        const settingsPath = path.join(getUserDataDir(), 'user-settings.json');
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(content);
        }
        return null;
    } catch (e) {
        console.error('Failed to load user settings', e);
        return null;
    }
});

ipcMain.handle('user-settings:save', async (_event, settings) => {
    try {
        const settingsPath = path.join(getUserDataDir(), 'user-settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return { success: true };
    } catch (e) {
        console.error('Failed to save user settings', e);
        return { success: false, error: e.message };
    }
});

// User History handlers
ipcMain.handle('user-history:get', async () => {
    try {
        const historyPath = path.join(getUserDataDir(), 'user-history.json');
        if (fs.existsSync(historyPath)) {
            const content = fs.readFileSync(historyPath, 'utf-8');
            return JSON.parse(content);
        }
        return null;
    } catch (e) {
        console.error('Failed to load user history', e);
        return null;
    }
});

ipcMain.handle('user-history:save', async (_event, history) => {
    try {
        const historyPath = path.join(getUserDataDir(), 'user-history.json');
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
        return { success: true };
    } catch (e) {
        console.error('Failed to save user history', e);
        return { success: false, error: e.message };
    }
});

app.whenReady().then(() => {
  // Ensure required directories exist
  const dataDir = getDataPath();
  const sessionsDir = path.join(dataDir, 'sessions');
  const imagesDir = path.join(dataDir, 'images');
  const thumbnailsDir = path.join(dataDir, 'thumbnails');

  [sessionsDir, imagesDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[Init] Created directory:', dir);
    }
  });

  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
