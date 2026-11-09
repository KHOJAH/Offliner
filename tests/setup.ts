// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      getMetadata: vi.fn(), addDownload: vi.fn(), cancelDownload: vi.fn(),
      pauseDownload: vi.fn(), resumeDownload: vi.fn(), getSettings: vi.fn(),
      updateSettings: vi.fn(), selectDownloadPath: vi.fn(), checkForUpdates: vi.fn(),
      onDownloadProgress: vi.fn(), onDownloadDone: vi.fn(), onDownloadError: vi.fn(),
      onDownloadMetadata: vi.fn(), onUpdateReady: vi.fn(), loadDownloads: vi.fn().mockResolvedValue([]),
      saveDownloads: vi.fn().mockResolvedValue(undefined), getVersion: vi.fn().mockResolvedValue('1.1.1'), platform: 'win32',
    },
    writable: true, configurable: true,
  });
}

