const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

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

    // Create image subdirectories
    const imageDirs = ['outputs', 'controls', 'references', 'sessions'];
    imageDirs.forEach(dir => {
        const dirPath = path.join(appDir, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });

    return appDir;
};

const getLogFilePath = () => path.join(getDataPath(), 'logs.json');

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

// IPC Handlers for synchronous file operations
ipcMain.on('save-sync', (event, filename, content) => {
    try {
        const filePath = path.join(getDataPath(), `${filename}.json`);
        fs.writeFileSync(filePath, content, 'utf-8');
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

ipcMain.handle('fetch-logs', async () => {
    return readLogs();
});

ipcMain.handle('check-for-updates', async () => {
  const result = await autoUpdater.checkForUpdates();
  return result;
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

// Save image file to specific folder
ipcMain.on('save-image-sync', (event, folder, filename, base64Data) => {
    try {
        const dataPath = getDataPath();
        const imagePath = path.join(dataPath, folder, filename);

        // Remove base64 header if present
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        fs.writeFileSync(imagePath, buffer);
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
        const dataPath = getDataPath();
        const sessionPath = path.join(dataPath, 'sessions', `${sessionId}.json`);
        fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
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
