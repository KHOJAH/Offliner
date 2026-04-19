// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type {
  Settings, VideoMetadata, DownloadConfig, UpdateInfo,
  EventMessage, DownloadItem,
} from '@/types';

const api = {
  // IPC calls
  getMetadata: (url: string) => ipcRenderer.invoke('app:get-metadata', url) as Promise<VideoMetadata>,
  addDownload: (config: DownloadConfig) => ipcRenderer.invoke('app:add-download', config) as Promise<string>,
  cancelDownload: (id: string) => ipcRenderer.invoke('app:cancel-download', id) as Promise<void>,
  pauseDownload: (id: string) => ipcRenderer.invoke('app:pause-download', id) as Promise<void>,
  resumeDownload: (id: string, config?: any) => ipcRenderer.invoke('app:resume-download', id, config) as Promise<void>,
  getSettings: () => ipcRenderer.invoke('app:get-settings') as Promise<Settings>,
  updateSettings: (partial: Partial<Settings>) => ipcRenderer.invoke('app:update-settings', partial) as Promise<void>,
  loadDownloads: () => ipcRenderer.invoke('app:load-downloads') as Promise<DownloadItem[]>,
  saveDownloads: (downloads: DownloadItem[]) => ipcRenderer.invoke('app:save-downloads', downloads) as Promise<void>,
  selectDownloadPath: () => ipcRenderer.invoke('app:select-download-path') as Promise<string | null>,
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates') as Promise<UpdateInfo | null>,
  openFile: (filePath: string) => ipcRenderer.invoke('shell:open', filePath) as Promise<void>,
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show', filePath) as Promise<void>,
  fileExists: (filePath: string) => ipcRenderer.invoke('shell:exists', filePath) as Promise<boolean>,
  deleteFile: (filePath: string) => ipcRenderer.invoke('shell:delete', filePath) as Promise<boolean>,

  // Event listeners
  onDownloadProgress: (cb: (event: EventMessage) => void) => {
    ipcRenderer.on('download:progress', (_e, event: EventMessage) => cb(event));
  },
  onDownloadDone: (cb: (event: EventMessage) => void) => {
    ipcRenderer.on('download:done', (_e, event: EventMessage) => cb(event));
  },
  onDownloadError: (cb: (event: EventMessage) => void) => {
    ipcRenderer.on('download:error', (_e, event: EventMessage) => cb(event));
  },
  onDownloadMetadata: (cb: (event: EventMessage) => void) => {
    ipcRenderer.on('download:metadata', (_e, event: EventMessage) => cb(event));
  },
  onUpdateReady: (cb: (info: { version: string; releaseNotes?: string }) => void) => {
    ipcRenderer.on('app:update-ready', (_e, info) => cb(info));
  },

  // Platform info
  platform: process.platform,

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
