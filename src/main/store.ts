// src/main/store.ts
import Store from 'electron-store';
import type { Settings, DownloadItem } from '@/types';
import { app } from 'electron';
import { join } from 'path';

const defaults: Settings = {
  downloadPath: join(app.getPath('downloads'), 'Offliner'),
  defaultVideoFormat: 'bestvideo+bestaudio/best', 
  defaultAudioFormat: 'flac',
  defaultQuality: '1080p',
  concurrency: 3,
  autoUpdate: true,
  theme: 'glass',
  maxClipDuration: 3600,
};

let settingsStore: Store<Settings>;
let downloadsStore: Store<{ downloads: DownloadItem[] }>;

export function getSettingsStore(): Store<Settings> {
  if (!settingsStore) {
    settingsStore = new Store<Settings>({
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

export function getSettings(): Settings {
  const s = getSettingsStore();
  return s.store as Settings;
}

export function updateSettings(partial: Partial<Settings>): void {
  const s = getSettingsStore();
  const current = s.store as Settings;
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
