// src/renderer/stores/settingsStore.ts
import { create } from 'zustand';
import type { Settings, AppTheme } from '@/types';
import { ipcClient } from '@/renderer/ipc/client';

interface SettingsState extends Settings<AppTheme> {
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings<AppTheme>>) => Promise<void>;
}

const defaults: Settings<AppTheme> = {
  downloadPath: '',
  defaultVideoFormat: '137+140',
  defaultAudioFormat: 'mp3',
  defaultQuality: '1080p',
  concurrency: 3,
  autoUpdate: true,
  theme: 'dark',
  maxClipDuration: 3600,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,

  loadSettings: async () => {
    const settings = await ipcClient.getSettings();
    set(settings);
  },

  updateSettings: async (partial: Partial<Settings>) => {
    await ipcClient.updateSettings(partial);
    set(partial);
  },
}));
