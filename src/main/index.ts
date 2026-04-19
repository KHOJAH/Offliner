// src/main/index.ts
import { app, BrowserWindow, Tray, Menu } from 'electron';
import { join } from 'path';
import { registerIPCHandlers, startWorker, stopWorker, setMainWindow } from './ipc';
import { setupAutoUpdater, restartAndInstall } from './updater';
import { ipcMain } from 'electron';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createTray(): void {
  const iconPath = join(__dirname, '..', '..', 'build', 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show App', 
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('Offliner');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createWindow(): void {
  const iconPath = join(__dirname, '..', '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom title bar
    backgroundColor: '#1a1a2e',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  setMainWindow(mainWindow);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    setMainWindow(null);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIPCHandlers();
  startWorker();
  createWindow();
  createTray();

  if (mainWindow) {
    setupAutoUpdater(mainWindow);
  }

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

app.on('before-quit', () => {
  stopWorker();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Restart handler for auto-update
ipcMain.on('app:restart-after-update', () => {
  restartAndInstall();
});

// Window controls (for frameless window)
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());
