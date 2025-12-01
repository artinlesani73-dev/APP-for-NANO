const { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Heavy, non-essential dependencies are loaded lazily after app.ready
let autoUpdater;
let os;

const loadDeferredModules = () => {
  if (!autoUpdater) {
    autoUpdater = require('electron-updater').autoUpdater;
  }
  if (!os) {
    os = require('os');
  }
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

const distPath = path.join(__dirname, 'dist');
const cacheableExtensions = new Set(['.js', '.css', '.woff2', '.png', '.jpg', '.jpeg', '.svg', '.ico']);
const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const getMimeType = (filePath) => mimeTypes[path.extname(filePath)] || 'application/octet-stream';

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

const toDistPath = (pathname = '/') => {
  const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  return path.resolve(distPath, safePath);
};

const createNotFoundResponse = () => ({
  statusCode: 404,
  headers: { 'Content-Type': 'text/plain' },
  data: Readable.from('Not found')
});

const registerAppProtocol = () => {
  protocol.registerStreamProtocol('app', (request, callback) => {
    try {
      const url = new URL(request.url);
      const targetPath = toDistPath(url.pathname);

      if (!targetPath.startsWith(distPath)) {
        callback(createNotFoundResponse());
        return;
      }

      if (!fs.existsSync(targetPath)) {
        callback(createNotFoundResponse());
        return;
      }

      const ext = path.extname(targetPath);
      const stream = fs.createReadStream(targetPath);
      const cacheHeaders = cacheableExtensions.has(ext)
        ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
        : { 'Cache-Control': 'no-cache' };

      callback({
        statusCode: 200,
        headers: {
          'Content-Type': getMimeType(targetPath),
          ...cacheHeaders
        },
        data: stream
      });
    } catch (err) {
      console.error('Failed to serve asset', err);
      callback(createNotFoundResponse());
    }
  });
};

let mainWindow;
let postLoadTasksScheduled = false;

const schedulePostLoadWork = (window) => {
  if (postLoadTasksScheduled || !window?.webContents) return;
  postLoadTasksScheduled = true;

  window.webContents.once('did-finish-load', async () => {
    loadDeferredModules();
    registerDeferredIpcHandlers();
    await ensureUserCaches();
    autoUpdater?.checkForUpdatesAndNotify();
  });
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
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
        color: '#18181b', 
        symbolColor: '#e4e4e7',
        height: 40
    }
  });

  // Load from the 'dist' directory created by Vite build using cache-aware protocol
  mainWindow.loadURL('app://index.html');

  schedulePostLoadWork(mainWindow);
}

const sendUpdateStatus = (channel, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
};

// Ensure data directory exists
const getDataPath = () => {
    const userDataPath = app.getPath('documents');
    const appDir = path.join(userDataPath, 'ImageProvenanceStudio');
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
    }
    return appDir;
};

const defaultUserSettings = {
  theme: 'dark',
  showHistory: false,
  showGraphView: false
};

const defaultUserHistory = {
  lastSessionId: null,
  lastMixboardSessionId: null
};

let cachedUserSettings = { ...defaultUserSettings };
let cachedUserHistory = { ...defaultUserHistory };

const getCacheFilePaths = () => {
  const base = getDataPath();
  return {
    settings: path.join(base, 'user-settings.json'),
    history: path.join(base, 'user-history.json')
  };
};

const readJsonFile = async (filePath, fallback) => {
  try {
    const contents = await fs.promises.readFile(filePath, 'utf-8');
    return { ...fallback, ...(JSON.parse(contents) || {}) };
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn(`Failed to read ${filePath}`, err);
    }
    return { ...fallback };
  }
};

const writeJsonFile = async (filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to write ${filePath}`, err);
  }
};

const hydrateUserCaches = async () => {
  const paths = getCacheFilePaths();
  cachedUserSettings = await readJsonFile(paths.settings, defaultUserSettings);
  cachedUserHistory = await readJsonFile(paths.history, defaultUserHistory);
  return { settings: cachedUserSettings, history: cachedUserHistory };
};

const persistUserSettings = async (settings) => {
  cachedUserSettings = { ...cachedUserSettings, ...settings };
  await writeJsonFile(getCacheFilePaths().settings, cachedUserSettings);
  return cachedUserSettings;
};

const persistUserHistory = async (history) => {
  cachedUserHistory = { ...cachedUserHistory, ...history };
  await writeJsonFile(getCacheFilePaths().history, cachedUserHistory);
  return cachedUserHistory;
};

const getLogDirectory = () => {
    const sharedLogDir = process.env.LOG_SHARE_PATH || process.env.VITE_LOG_SHARE_PATH;
    if (sharedLogDir) {
        const normalized = path.isAbsolute(sharedLogDir)
          ? sharedLogDir
          : path.resolve(sharedLogDir);
        try {
            if (!fs.existsSync(normalized)) {
                fs.mkdirSync(normalized, { recursive: true });
            }
            return normalized;
        } catch (e) {
            console.error('Falling back to local log storage because shared log directory is unavailable', e);
        }
    }

    return getDataPath();
};

const getLogFilePath = () => {
    const logDir = getLogDirectory();
    return path.join(logDir, 'logs.json');
};

const readLogs = () => {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(logPath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to read logs', e);
        return [];
    }
};

const appendLog = (entry) => {
    const logs = readLogs();
    logs.push(entry);
    fs.writeFileSync(getLogFilePath(), JSON.stringify(logs, null, 2));
};

const logAutoUpdateEvent = (event, details) => {
  appendLog({
    type: 'auto-update',
    event,
    details,
    timestamp: new Date().toISOString()
  });
};
let ipcHandlersRegistered = false;
let userCacheHydrationPromise;

const notifyCachesReady = () => {
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('user-cache-ready', {
      settings: cachedUserSettings,
      history: cachedUserHistory
    });
  }
};

const ensureUserCaches = () => {
  if (!userCacheHydrationPromise) {
    userCacheHydrationPromise = hydrateUserCaches()
      .then((result) => {
        notifyCachesReady();
        return result;
      })
      .catch((err) => {
        console.error('Failed to hydrate user caches', err);
        return { settings: cachedUserSettings, history: cachedUserHistory };
      });
  }
  return userCacheHydrationPromise;
};

const registerDeferredIpcHandlers = () => {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;
  loadDeferredModules();

  ipcMain.on('save-sync', (event, filename, content) => {
    try {
      const filePath = path.join(getDataPath(), `${filename}.json`);
      fs.writeFileSync(filePath, content, 'utf-8');
      event.returnValue = true;
    } catch (e) {
      console.error('Save failed', e);
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

  ipcMain.on('log-event', (event, entry) => {
    try {
      appendLog(entry);
      event.returnValue = true;
    } catch (e) {
      console.error('Failed to write log entry', e);
      event.returnValue = false;
    }
  });

  ipcMain.handle('fetch-logs', async () => readLogs());

  ipcMain.handle('check-for-updates', async () => {
    logAutoUpdateEvent('check-for-updates');
    const result = await autoUpdater.checkForUpdates();
    logAutoUpdateEvent('check-for-updates-result', { versionInfo: result?.updateInfo });
    return result;
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

  ipcMain.handle('user-settings:get', async () => {
    await ensureUserCaches();
    return cachedUserSettings;
  });

  ipcMain.handle('user-settings:save', async (_event, settings) => {
    await ensureUserCaches();
    const updated = await persistUserSettings(settings || {});
    notifyCachesReady();
    return updated;
  });

  ipcMain.handle('user-history:get', async () => {
    await ensureUserCaches();
    return cachedUserHistory;
  });

  ipcMain.handle('user-history:save', async (_event, history) => {
    await ensureUserCaches();
    const updated = await persistUserHistory(history || {});
    notifyCachesReady();
    return updated;
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
};

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

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