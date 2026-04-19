// src/renderer/stores/settingsStore.ts
import { create } from 'zustand';
import type { Settings } from '@/types';
import { ipcClient } from '@/renderer/ipc/client';

interface SettingsState extends Settings {
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

const defaults: Settings = {
  downloadPath: '',
  defaultVideoFormat: '137+140',
  defaultAudioFormat: 'mp3',
  defaultQuality: '1080p',
  concurrency: 3,
  autoUpdate: true,
  theme: 'glass',
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
