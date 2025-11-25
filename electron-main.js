const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
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

  // Load from the 'dist' directory created by Vite build
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

// Ensure data directory exists
const getDataPath = () => {
    const userDataPath = app.getPath('documents');
    const appDir = path.join(userDataPath, 'ImageProvenanceStudio');
    if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
    }
    return appDir;
};

const getLogFilePath = () => {
    const dataDir = getDataPath();
    return path.join(dataDir, 'logs.json');
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

app.whenReady().then(() => {
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