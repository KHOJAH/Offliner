// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'electronAPI', {
  value: {
    getMetadata: vi.fn(), addDownload: vi.fn(), cancelDownload: vi.fn(),
    pauseDownload: vi.fn(), resumeDownload: vi.fn(), getSettings: vi.fn(),
    updateSettings: vi.fn(), selectDownloadPath: vi.fn(), checkForUpdates: vi.fn(),
    onDownloadProgress: vi.fn(), onDownloadDone: vi.fn(), onDownloadError: vi.fn(),
    onDownloadMetadata: vi.fn(), onUpdateReady: vi.fn(), platform: 'win32',
  },
  writable: true, configurable: true,
});
