// tests/integration/ipc.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  (window as any).electronAPI = {
    getMetadata: vi.fn(),
    addDownload: vi.fn(),
    cancelDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    selectDownloadPath: vi.fn(),
    checkForUpdates: vi.fn(),
    onDownloadProgress: vi.fn(),
    onDownloadDone: vi.fn(),
    onDownloadError: vi.fn(),
    onDownloadMetadata: vi.fn(),
    onUpdateReady: vi.fn(),
    platform: 'win32',
  };
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe('IPC Client Integration', () => {
  it('getMetadata returns video metadata', async () => {
    const mockMeta = { id: 'abc', title: 'Test', duration: 120, thumbnail: '', uploader: '', formats: [], is_playlist: false };
    (window.electronAPI.getMetadata as any).mockResolvedValue(mockMeta);
    const result = await window.electronAPI.getMetadata('https://youtube.com/watch?v=abc');
    expect(result).toEqual(mockMeta);
  });

  it('addDownload returns download id', async () => {
    (window.electronAPI.addDownload as any).mockResolvedValue('uuid-123');
    const id = await window.electronAPI.addDownload({ url: 'https://youtube.com/watch?v=abc' });
    expect(id).toBe('uuid-123');
  });

  it('getSettings returns settings object', async () => {
    const mockSettings = {
      downloadPath: '/downloads', defaultVideoFormat: '137+140', defaultAudioFormat: 'mp3',
      defaultQuality: '1080p', concurrency: 3, autoUpdate: true, theme: 'glass', maxClipDuration: 3600,
    };
    (window.electronAPI.getSettings as any).mockResolvedValue(mockSettings);
    const result = await window.electronAPI.getSettings();
    expect(result.concurrency).toBe(3);
  });
});
