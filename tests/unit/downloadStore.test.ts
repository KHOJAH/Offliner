import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDownloadStore } from '../../src/renderer/stores/downloadStore';
import { ipcClient } from '../../src/renderer/ipc/client';
import type { DownloadItem } from '../../src/types';

vi.mock('../../src/renderer/ipc/client', () => ({
  ipcClient: {
    saveDownloads: vi.fn(),
    loadDownloads: vi.fn(),
    fileExists: vi.fn(),
  },
}));

describe('downloadStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useDownloadStore.setState({ downloads: new Map() });
  });

  it('clearFinishedDownloads removes only finished, cancelled, or error downloads', () => {
    const { addDownload, clearFinishedDownloads } = useDownloadStore.getState();

    const items: DownloadItem[] = [
      { id: '1', status: 'done', title: 'Done', progress: 100, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
      { id: '2', status: 'cancelled', title: 'Cancelled', progress: 50, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
      { id: '3', status: 'error', title: 'Error', progress: 10, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
      { id: '4', status: 'downloading', title: 'Downloading', progress: 30, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
      { id: '5', status: 'queued', title: 'Queued', progress: 0, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
    ];

    items.forEach(addDownload);

    clearFinishedDownloads();

    const remaining = useDownloadStore.getState().downloads;
    expect(remaining.size).toBe(2);
    expect(remaining.has('4')).toBe(true);
    expect(remaining.has('5')).toBe(true);
    expect(ipcClient.saveDownloads).toHaveBeenCalled();
  });

  it('clearFinishedDownloads does nothing if no downloads to clear', () => {
    const { addDownload, clearFinishedDownloads } = useDownloadStore.getState();

    const items: DownloadItem[] = [
      { id: '4', status: 'downloading', title: 'Downloading', progress: 30, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
      { id: '5', status: 'queued', title: 'Queued', progress: 0, createdAt: Date.now(), url: '', thumbnail: '', config: { url: '' } },
    ];

    items.forEach(addDownload);
    vi.clearAllMocks();

    clearFinishedDownloads();

    const remaining = useDownloadStore.getState().downloads;
    expect(remaining.size).toBe(2);
    expect(ipcClient.saveDownloads).not.toHaveBeenCalled();
  });
});
