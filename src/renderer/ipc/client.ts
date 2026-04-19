// src/renderer/ipc/client.ts
import type {
  Settings, VideoMetadata, DownloadConfig, UpdateInfo,
  EventMessage, DownloadItem,
} from '@/types';

declare global {
  interface Window {
    electronAPI: {
      getMetadata: (url: string) => Promise<VideoMetadata>;
      addDownload: (config: DownloadConfig) => Promise<string>;
      cancelDownload: (id: string) => Promise<void>;
      pauseDownload: (id: string) => Promise<void>;
      resumeDownload: (id: string, config?: DownloadConfig) => Promise<void>;
      getSettings: () => Promise<Settings>;
      updateSettings: (partial: Partial<Settings>) => Promise<void>;
      loadDownloads: () => Promise<DownloadItem[]>;
      saveDownloads: (downloads: DownloadItem[]) => Promise<void>;
      selectDownloadPath: () => Promise<string | null>;
      checkForUpdates: () => Promise<UpdateInfo | null>;
      openFile: (filePath: string) => Promise<void>;
      showInFolder: (filePath: string) => Promise<void>;
      fileExists: (filePath: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      onDownloadProgress: (cb: (event: EventMessage) => void) => void;
      onDownloadDone: (cb: (event: EventMessage) => void) => void;
      onDownloadError: (cb: (event: EventMessage) => void) => void;
      onDownloadMetadata: (cb: (event: EventMessage) => void) => void;
      onUpdateReady: (cb: (info: { version: string; releaseNotes?: string }) => void) => void;
      platform: string;
    };
  }
}

export const ipcClient = {
  getMetadata: (url: string) => window.electronAPI.getMetadata(url),
  addDownload: (config: DownloadConfig) => window.electronAPI.addDownload(config),
  cancelDownload: (id: string) => window.electronAPI.cancelDownload(id),
  pauseDownload: (id: string) => window.electronAPI.pauseDownload(id),
  resumeDownload: (id: string, config?: DownloadConfig) => window.electronAPI.resumeDownload(id, config),
  getSettings: () => window.electronAPI.getSettings(),
  updateSettings: (partial: Partial<Settings>) => window.electronAPI.updateSettings(partial),
  loadDownloads: () => window.electronAPI.loadDownloads(),
  saveDownloads: (downloads: DownloadItem[]) => window.electronAPI.saveDownloads(downloads),
  selectDownloadPath: () => window.electronAPI.selectDownloadPath(),
  checkForUpdates: () => window.electronAPI.checkForUpdates(),
  openFile: (filePath: string) => window.electronAPI.openFile(filePath),
  showInFolder: (filePath: string) => window.electronAPI.showInFolder(filePath),
  fileExists: (filePath: string) => window.electronAPI.fileExists(filePath),
  deleteFile: (filePath: string) => window.electronAPI.deleteFile(filePath),
  onDownloadProgress: (cb: (event: EventMessage) => void) => window.electronAPI.onDownloadProgress(cb),
  onDownloadDone: (cb: (event: EventMessage) => void) => window.electronAPI.onDownloadDone(cb),
  onDownloadError: (cb: (event: EventMessage) => void) => window.electronAPI.onDownloadError(cb),
  onDownloadMetadata: (cb: (event: EventMessage) => void) => window.electronAPI.onDownloadMetadata(cb),
  onUpdateReady: (cb: (info: { version: string; releaseNotes?: string }) => void) => window.electronAPI.onUpdateReady(cb),
  platform: window.electronAPI.platform,
};
