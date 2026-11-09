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
        const isFinal = existing.status === 'done' || existing.status === 'error' || existing.status === 'cancelled';
        const isPaused = existing.status === 'paused';

        const isLateProgressChunk =
          (isFinal && (data.status === 'downloading' || data.progress !== undefined || data.speed !== undefined || data.eta !== undefined)) ||
          (isPaused && (data.progress !== undefined || (data.status === 'downloading' && data.progress !== undefined)));

        let updatedStatus = data.status || existing.status;
        if (isLateProgressChunk && data.status === 'downloading') {
          updatedStatus = existing.status;
        }

        const safeData = { ...data };
        if (isLateProgressChunk) {
          delete safeData.progress;
          delete safeData.speed;
          delete safeData.speedBps;
          delete safeData.eta;
          delete safeData.etaSeconds;
          delete safeData.filePath;
          if (updatedStatus === existing.status) {
            delete safeData.status;
          }
        }

        const monotonicProgress = safeData.progress !== undefined
          ? Math.max(existing.progress, safeData.progress ?? 0)
          : existing.progress;

        const updated: DownloadItem = {
          ...existing,
          ...safeData,
          progress: monotonicProgress,
          status: updatedStatus,
        };

        next.set(id, updated);
        // Only save to disk for real status changes or completion, not every progress tick or late chunk
        const statusChanged = updatedStatus !== existing.status;
        if (statusChanged || (data.status && !isLateProgressChunk) || updated.progress === 100) {
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
        try {
          const exists = await ipcClient.fileExists(d.filePath);
          if (!exists) {
            updateProgress(d.id, { status: 'cancelled' });
          }
        } catch {
          // Ignore filesystem errors (e.g. disconnected drive, EPERM, network share drop)
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
