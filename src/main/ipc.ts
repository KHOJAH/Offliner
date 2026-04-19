// src/main/ipc.ts
import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import type {
  Settings, VideoMetadata, DownloadConfig, UpdateInfo,
  CommandMessage, EventMessage, DownloadItem,
} from '@/types';
import { getSettings, updateSettings, getPersistentDownloads, savePersistentDownloads } from './store';
import { checkForUpdates } from './updater';
import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

let worker: ChildProcess | null = null;
const pendingCommands = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
const mainWindowRef = { current: null as BrowserWindow | null };

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef.current = win;
}

export function startWorker(): void {
  const workerPath = join(__dirname, '..', 'worker', 'index.js');
  const isDev = !app.isPackaged;
  console.log(`[main] Starting worker from: ${workerPath} (isDev: ${isDev})`);
  
  worker = spawn(process.execPath, [workerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { 
      ...process.env, 
      NODE_ENV: isDev ? 'development' : 'production',
      ELECTRON_RUN_AS_NODE: '1', // Force Electron to act as Node.js
      APP_PATH: app.getAppPath(),
      RESOURCES_PATH: isDev ? join(process.cwd(), 'build') : process.resourcesPath,
    },
  });

  worker.stdout!.setEncoding('utf8');
  let stdoutBuffer = '';
  worker.stdout!.on('data', (chunk: string) => {
    stdoutBuffer += chunk;
    let lineEndIndex;
    while ((lineEndIndex = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, lineEndIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(lineEndIndex + 1);
      if (!line) continue;
      try {
        const event: EventMessage = JSON.parse(line);
        console.log(`[main] Received worker event: ${event.action} (ID: ${event.downloadId || 'none'})`);
        handleWorkerEvent(event);
      } catch (err) {
        console.error('[main] Failed to parse worker JSON:', err, 'Line:', line.slice(0, 100) + '...');
      }
    }
  });

  worker.stderr!.setEncoding('utf8');
  worker.stderr!.on('data', (chunk: string) => {
    console.error('[worker stderr]', chunk);
  });

  worker.on('exit', (code) => {
    console.log(`[worker] exited with code ${code}`);
  });

  worker.on('error', (err) => {
    console.error('[worker] failed to spawn', err);
  });
}

function sendToWorker(cmd: CommandMessage): void {
  if (worker && worker.stdin?.writable) {
    console.log(`[main] Sending command to worker: ${cmd.action} (ID: ${cmd.id})`);
    worker.stdin.write(JSON.stringify(cmd) + '\n');
  } else {
    console.error('[main] Cannot send to worker: worker or stdin not available');
  }
}

function handleWorkerEvent(event: EventMessage): void {
  const win = mainWindowRef.current;
  if (!win) return;

  if (event.action === 'metadata' && event.downloadId) {
    const pending = pendingCommands.get(event.downloadId);
    if (pending) {
      pending.resolve(event.data);
      pendingCommands.delete(event.downloadId);
    }
    return;
  }

  // Forward all other events to renderer
  win.webContents.send(`download:${event.action}`, event);
}

export function registerIPCHandlers(): void {
  // Metadata fetch
  ipcMain.handle('app:get-metadata', async (_event, url: string): Promise<VideoMetadata> => {
    const id = randomUUID();
    const cmd: CommandMessage = { type: 'command', id, action: 'metadata', args: { url } };
    return new Promise<VideoMetadata>((resolve, reject) => {
      pendingCommands.set(id, { resolve, reject });
      sendToWorker(cmd);
      // Timeout after 30s
      setTimeout(() => {
        pendingCommands.delete(id);
        reject(new Error('Metadata fetch timed out'));
      }, 30000);
    });
  });

  // Add download
  ipcMain.handle('app:add-download', async (_event, config: DownloadConfig): Promise<string> => {
    const id = randomUUID();
    const cmd: CommandMessage = { type: 'command', id, action: 'download', args: config as any };
    sendToWorker(cmd);
    return id;
  });

  // Cancel download
  ipcMain.handle('app:cancel-download', async (_event, downloadId: string): Promise<void> => {
    const cmd: CommandMessage = { type: 'command', id: randomUUID(), action: 'cancel', args: { downloadId } };
    sendToWorker(cmd);
  });

  // Pause download
  ipcMain.handle('app:pause-download', async (_event, downloadId: string): Promise<void> => {
    const cmd: CommandMessage = { type: 'command', id: randomUUID(), action: 'pause', args: { downloadId } };
    sendToWorker(cmd);
  });

  // Resume download
  ipcMain.handle('app:resume-download', async (_event, downloadId: string, config?: DownloadConfig): Promise<void> => {
    console.log(`[main] Resume handler called for ID: ${downloadId}. Config URL: ${config?.url || 'MISSING'}`);
    const args: any = { downloadId };
    if (config) {
      args.opts = {
        url: config.url,
        format: config.format,
        outputPath: config.outputPath,
        audioFormat: config.audioFormat,
        audioQuality: config.audioQuality,
        clips: config.clips,
        extractAudio: !!config.audioFormat,
        isPlaylist: (config as any).isPlaylist,
      };
      args.url = config.url;
    } else {
      console.warn(`[main] Resume called for ${downloadId} WITHOUT config!`);
    }
    const cmd: CommandMessage = { type: 'command', id: randomUUID(), action: 'resume', args };
    sendToWorker(cmd);
  });

  // Get settings
  ipcMain.handle('app:get-settings', (): Settings => {
    return getSettings();
  });

  // Update settings
  ipcMain.handle('app:update-settings', (_event, partial: Partial<Settings>): void => {
    updateSettings(partial);
  });

  // Select download path
  ipcMain.handle('app:select-download-path', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Shell operations
  ipcMain.handle('shell:open', async (_event, filePath: string): Promise<void> => {
    console.log(`[main] Shell open request for: "${filePath}"`);
    try {
      await shell.openPath(filePath);
    } catch (err) {
      console.error(`[main] Shell open failed for "${filePath}":`, err);
    }
  });

  ipcMain.handle('shell:show', async (_event, filePath: string): Promise<void> => {
    console.log(`[main] Shell show in folder request for: "${filePath}"`);
    try {
      shell.showItemInFolder(filePath);
    } catch (err) {
      console.error(`[main] Shell show in folder failed for "${filePath}":`, err);
    }
  });

  ipcMain.handle('shell:exists', (_event, filePath: string): boolean => {
    try {
      return existsSync(filePath);
    } catch {
      return false;
    }
  });

  ipcMain.handle('shell:delete', async (_event, filePath: string): Promise<boolean> => {
    console.log(`[main] Shell delete request for: "${filePath}"`);
    try {
      if (!existsSync(filePath)) {
        console.warn(`[main] Delete failed: File does not exist: "${filePath}"`);
        return false;
      }
      await shell.trashItem(filePath);
      return true;
    } catch (err) {
      console.error(`[main] Shell delete failed for "${filePath}":`, err);
      return false;
    }
  });

  // Persistent downloads
  ipcMain.handle('app:load-downloads', (): DownloadItem[] => {
    return getPersistentDownloads();
  });

  ipcMain.handle('app:save-downloads', (_event, downloads: DownloadItem[]): void => {
    savePersistentDownloads(downloads);
  });

  // Check for updates
  ipcMain.handle('app:check-for-updates', async (): Promise<UpdateInfo | null> => {
    return checkForUpdates();
  });
}

export function stopWorker(): void {
  if (worker) {
    worker.kill();
    worker = null;
  }
  pendingCommands.clear();
}
