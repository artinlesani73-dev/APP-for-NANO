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
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

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

// Export/download a single image
ipcMain.on('export-image-sync', (event, folder, filename, savePath) => {
    try {
        const dataPath = getDataPath();
        const sourcePath = path.join(dataPath, folder, filename);

        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, savePath);
            event.returnValue = { success: true };
        } else {
            event.returnValue = { success: false, error: 'File not found' };
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
