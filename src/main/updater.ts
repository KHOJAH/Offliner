// src/main/updater.ts
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo } from '@/types';

let updateAvailable = false;
let downloadedUpdate: UpdateInfo | null = null;

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  if (updateAvailable) return downloadedUpdate;

  try {
    const info = await autoUpdater.checkForUpdates();
    if (info && info.updateInfo) {
      updateAvailable = true;
      downloadedUpdate = {
        version: info.updateInfo.version || 'unknown',
        releaseDate: info.updateInfo.releaseDate ? new Date(info.updateInfo.releaseDate).toISOString() : new Date().toISOString(),
        releaseNotes: typeof info.updateInfo.releaseNotes === 'string'
          ? info.updateInfo.releaseNotes
          : undefined,
      };
      return downloadedUpdate;
    }
  } catch (err) {
    console.error('Update check failed:', err);
  }
  return null;
}

export function getUpdateInfo(): UpdateInfo | null {
  return downloadedUpdate;
}

export function setupAutoUpdater(mainWindow: Electron.BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-downloaded', (info) => {
    downloadedUpdate = {
      version: info.version,
      releaseDate: info.releaseDate ? new Date(info.releaseDate).toISOString() : new Date().toISOString(),
      releaseNotes: info.releaseNotes as string | undefined,
    };
    mainWindow.webContents.send('app:update-ready', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });

  // Check on startup
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

export function restartAndInstall(): void {
  autoUpdater.quitAndInstall();
}
