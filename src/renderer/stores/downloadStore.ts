// src/renderer/stores/downloadStore.ts
import { create } from 'zustand';
import type { DownloadItem, EventMessage } from '@/types';
import { ipcClient } from '@/renderer/ipc/client';

interface DownloadState {
  downloads: Map<string, DownloadItem>;
  addDownload: (item: DownloadItem) => void;
  removeDownload: (id: string) => void;
  updateProgress: (id: string, data: Partial<DownloadItem>) => void;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  removePermanent: (id: string) => void;
  clearFinishedDownloads: () => void;
  loadDownloads: () => Promise<void>;
  verifyDownloads: () => Promise<void>;
  subscribeToEvents: () => () => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: new Map(),

  addDownload: (item: DownloadItem) => {
    set((state) => {
      const next = new Map(state.downloads);
      next.set(item.id, item);
      ipcClient.saveDownloads(Array.from(next.values()));
      return { downloads: next };
    });
  },

  removeDownload: (id: string) => {
    set((state) => {
      const next = new Map(state.downloads);
      next.delete(id);
      ipcClient.saveDownloads(Array.from(next.values()));
      return { downloads: next };
    });
  },

  updateProgress: (id: string, data: Partial<DownloadItem>) => {
    set((state) => {
      const next = new Map(state.downloads);
      const existing = next.get(id);
      if (existing) {
        let updatedStatus = data.status || existing.status;

        // Final states: done, error, cancelled
        const isFinal = existing.status === 'done' || existing.status === 'error' || existing.status === 'cancelled';
        
        if (isFinal && data.status === 'downloading' && data.progress !== undefined) {
          // Block transition from final to downloading if it's a progress event
          updatedStatus = existing.status;
        } else if (existing.status === 'paused' && data.status === 'downloading' && data.progress !== undefined) {
          // Block transition from paused to downloading if it's a progress event
          // This prevents delayed progress events from overwriting the paused state
          updatedStatus = existing.status;
        }
        
        const updated = { ...existing, ...data, status: updatedStatus };
        next.set(id, updated);
        // Only save to disk for status changes or completion, not every progress tick
        if (data.status || data.progress === 100) {
          ipcClient.saveDownloads(Array.from(next.values()));
        }
      }
      return { downloads: next };
    });
  },

  loadDownloads: async () => {
    const list = await ipcClient.loadDownloads();
    set({ downloads: new Map(list.map(d => [d.id, d])) });
    await get().verifyDownloads();
  },

  verifyDownloads: async () => {
    const { downloads, updateProgress } = get();
    const list = Array.from(downloads.values());
    
    for (const d of list) {
      if (d.status === 'done' && d.filePath) {
        const exists = await ipcClient.fileExists(d.filePath);
        if (!exists) {
          updateProgress(d.id, { status: 'cancelled' });
        }
      }
    }
  },

  pauseDownload: async (id: string) => {
    await ipcClient.pauseDownload(id);
    get().updateProgress(id, { status: 'paused' });
  },

  resumeDownload: async (id: string) => {
    const d = get().downloads.get(id);
    if (d) {
      await ipcClient.resumeDownload(id, d.config);
      get().updateProgress(id, { status: 'downloading' });
    }
  },

  cancelDownload: async (id: string) => {
    await ipcClient.cancelDownload(id);
    get().updateProgress(id, { status: 'cancelled' });
  },

  removePermanent: (id: string) => {
    get().removeDownload(id);
  },

  clearFinishedDownloads: () => {
    set((state) => {
      const next = new Map(state.downloads);
      let changed = false;
      for (const [id, item] of next) {
        if (item.status === 'done' || item.status === 'cancelled' || item.status === 'error') {
          next.delete(id);
          changed = true;
        }
      }
      if (changed) {
        ipcClient.saveDownloads(Array.from(next.values()));
        return { downloads: next };
      }
      return state;
    });
  },

  subscribeToEvents: () => {
    const onProgress = (event: EventMessage) => {
      if (event.downloadId && event.action === 'progress') {
        get().updateProgress(event.downloadId, {
          progress: event.percent || 0,
          speed: event.speed,
          speedBps: event.speedBps,
          eta: event.eta,
          etaSeconds: event.etaSeconds,
          totalBytes: event.totalBytes,
          downloadedBytes: event.downloadedBytes,
          status: 'downloading',
        });
      }
    };

    const onDone = (event: EventMessage) => {
      if (event.downloadId) {
        get().updateProgress(event.downloadId, {
          status: 'done',
          progress: 100,
          filePath: event.filePath,
          completedAt: Date.now(),
        });
      }
    };

    const onError = (event: EventMessage) => {
      if (event.downloadId) {
        get().updateProgress(event.downloadId, {
          status: 'error',
          errorMessage: event.message,
        });
      }
    };

    ipcClient.onDownloadProgress(onProgress);
    ipcClient.onDownloadDone(onDone);
    ipcClient.onDownloadError(onError);

    return () => {
      // Cleanup if needed - currently electronAPI.on... doesn't return cleanup
    };
  },
}));
