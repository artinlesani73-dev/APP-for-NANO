const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

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
let adminWindow;
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

const isAdminEnabled = () => Boolean(process.env.VITE_ADMIN_PASSPHRASE || process.env.ADMIN_ENABLED === 'true');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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

function createAdminWindow() {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.focus();
    return adminWindow;
  }

  adminWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
    title: 'Admin Dashboard',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
        color: '#0b1120',
        symbolColor: '#e4e4e7',
        height: 40
    }
  });

  adminWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), {
    query: { admin: '1' }
  });

  adminWindow.on('closed', () => {
    adminWindow = undefined;
  });

  return adminWindow;
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

// IPC Handlers for synchronous file operations
ipcMain.on('save-sync', (event, filename, content) => {
    try {
        writeFileBoth(`${filename}.json`, content, 'utf-8');
        event.returnValue = true;
    } catch (e) {
        console.error("Save failed", e);
        event.returnValue = false;
    }
});

ipcMain.on('load-sync', (event, filename) => {
    try {
        const filePath = path.join(getDataPath(), `${filename}.json`);
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
        const dir = getDataPath();
        const files = fs.readdirSync(dir);
        const results = [];

        files.forEach(file => {
            if (file.startsWith(prefix) && file.endsWith('.json')) {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8');
                results.push({ key: file.replace('.json', ''), content });
            }
        });
        event.returnValue = results;
    } catch (e) {
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

ipcMain.handle('sync-user-data', async () => {
    return syncLocalToShared();
});

ipcMain.handle('check-for-updates', async () => {
  const result = await autoUpdater.checkForUpdates();
  return result;
});

ipcMain.handle('verify-admin-passphrase', async (_event, candidate) => {
  if (!isAdminEnabled()) return false;
  const expected = process.env.VITE_ADMIN_PASSPHRASE || '';
  return expected.length > 0 && candidate === expected;
});

ipcMain.handle('open-admin-window', async (_event, verified) => {
  if (!verified || !isAdminEnabled()) return false;
  createAdminWindow();
  return true;
});

ipcMain.handle('get-admin-metrics', async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptimeSeconds = os.uptime();
  const load = os.loadavg();
  const cpus = os.cpus();
  const cpuUsage = load[0] / cpus.length;

  const sessionsDir = path.join(getDataPath(), 'sessions');
  const sessionCount = fs.existsSync(sessionsDir)
    ? fs.readdirSync(sessionsDir).filter(file => file.endsWith('.json')).length
    : 0;

  return {
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds,
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentUsed: totalMem > 0 ? usedMem / totalMem : 0
    },
    cpu: {
      cores: cpus.length,
      load: cpuUsage,
      model: cpus[0]?.model ?? 'unknown'
    },
    sessions: sessionCount,
    timestamp: new Date().toISOString()
  };
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus('update-available', info);
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('update-download-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
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
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (error) => {
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

// List all sessions
ipcMain.on('list-sessions-sync', (event) => {
    try {
        const dataPath = getDataPath();
        const sessionsDir = path.join(dataPath, 'sessions');
        const files = fs.readdirSync(sessionsDir);
        const sessions = [];

        files.forEach(file => {
            if (file.endsWith('.json')) {
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

app.whenReady().then(() => {
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
