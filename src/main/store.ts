// src/main/store.ts
import Store from 'electron-store';
import type { Settings, DownloadItem, AppTheme } from '@/types';
import { app } from 'electron';
import { join } from 'path';

const defaults: Settings<AppTheme> = {
  downloadPath: join(app.getPath('downloads'), 'Offliner'),
  defaultVideoFormat: 'bestvideo+bestaudio/best', 
  defaultAudioFormat: 'flac',
  defaultQuality: '1080p',
  concurrency: 3,
  autoUpdate: true,
  theme: 'dark',
  maxClipDuration: 3600,
};

let settingsStore: Store<Settings<AppTheme>>;
let downloadsStore: Store<{ downloads: DownloadItem[] }>;

export function getSettingsStore(): Store<Settings<AppTheme>> {
  if (!settingsStore) {
    settingsStore = new Store<Settings<AppTheme>>({
      name: 'settings',
      defaults,
      cwd: app.getPath('userData'),
    });
  }
  return settingsStore;
}

export function getDownloadsStore(): Store<{ downloads: DownloadItem[] }> {
  if (!downloadsStore) {
    downloadsStore = new Store<{ downloads: DownloadItem[] }>({
      name: 'downloads',
      defaults: { downloads: [] },
      cwd: app.getPath('userData'),
    });
  }
  return downloadsStore;
}

export function getSettings(): Settings<AppTheme> {
  const s = getSettingsStore();
  return s.store as Settings<AppTheme>;
}

export function updateSettings(partial: Partial<Settings<AppTheme>>): void {
  const s = getSettingsStore();
  const current = s.store as Settings<AppTheme>;
  s.set({ ...current, ...partial });
}

export function getPersistentDownloads(): DownloadItem[] {
  const s = getDownloadsStore();
  const downloads = (s.get('downloads') || []) as DownloadItem[];
  // Reset active statuses to paused on load
  return downloads.map(d => {
    if (d.status === 'downloading' || d.status === 'queued') {
      return { ...d, status: 'paused', progress: d.progress || 0 };
    }
    return d;
  });
}

export function savePersistentDownloads(downloads: DownloadItem[]): void {
  const s = getDownloadsStore();
  s.set('downloads', downloads);
}
