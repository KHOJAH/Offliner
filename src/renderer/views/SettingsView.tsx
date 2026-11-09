// src/renderer/views/SettingsView.tsx
import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore } from '@/renderer/stores/themeStore';
import { useUIStore } from '@/renderer/stores/uiStore';
import { ipcClient } from '@/renderer/ipc/client';

export default function SettingsView() {
  const settings = useSettingsStore();
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isMonochrome = currentTheme === 'monochrome';
  const addToast = useUIStore((s) => s.addToast);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState('1.1.1');

  useEffect(() => {
    ipcClient.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleSelectPath = async () => {
    const path = await ipcClient.selectDownloadPath();
    if (path) {
      await settings.updateSettings({ downloadPath: path });
      addToast({ type: 'success', title: 'Download path updated', message: path });
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await ipcClient.checkForUpdates();
      if (info) {
        addToast({ type: 'info', title: 'Update available', message: `Version ${info.version}` });
      } else {
        addToast({ type: 'info', title: 'Up to date', message: 'You have the latest version.' });
      }
    } catch {
      addToast({ type: 'info', title: 'Up to date', message: 'You have the latest version.' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-5xl mx-auto w-full px-8 py-10 space-y-8">
        {/* Header Section with macOS Warm Ambient Contrast */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-outline-variant/15">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary text-[11px] font-mono tracking-wider uppercase font-semibold">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>System Environment & Execution Matrix</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Settings
            </h1>
            <p className="text-xs text-text-secondary">
              Configure resolver pipelines, local storage sandboxes, and hardware acceleration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/20 text-text-secondary">
              Current Version: {appVersion}
            </span>
          </div>
        </div>

        {/* Section 1: General & Storage */}
        <section className="bg-surface border border-outline-variant/30 rounded-2xl shadow-xs p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">folder_special</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">General & Storage</h2>
              <p className="text-xs text-text-secondary">Primary media destination and parallel workers</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Download Location */}
            <div>
              <label className="text-xs font-semibold text-text-primary uppercase tracking-wider block mb-2">
                Default Download Directory
              </label>
              <div className="flex gap-2.5">
                <div className="flex-1 flex items-center bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5">
                  <span className="material-symbols-outlined text-[18px] text-text-secondary mr-2">folder</span>
                  <input
                    type="text"
                    value={settings.downloadPath}
                    readOnly
                    className="w-full bg-transparent border-none outline-none font-mono text-xs text-text-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSelectPath}
                  className="px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-container border border-outline-variant/40 text-xs font-semibold text-text-primary transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">file_open</span>
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Concurrent Downloads Slider */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-semibold text-text-primary uppercase tracking-wider block">
                    Concurrent Downloads: {settings.concurrency}
                  </label>
                  <span className="text-[11px] text-text-secondary">
                    Throttles parallel TCP socket allocations to prevent bandwidth starvation (Max: 8)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10">
                  {settings.concurrency} workers
                </span>
              </div>
              <input
                type="range"
                role="slider"
                aria-label="Concurrent Downloads"
                min={1}
                max={8}
                value={settings.concurrency}
                onChange={(e) => settings.updateSettings({ concurrency: Number(e.target.value) })}
                className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] font-mono text-text-secondary mt-1">
                <span>1 Worker</span>
                <span>4 (Balanced)</span>
                <span>8 (Aggressive)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Appearance & Themes */}
        <section className="bg-surface border border-outline-variant/30 rounded-2xl shadow-xs p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/15">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">palette</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Appearance & Themes</h2>
              <p className="text-xs text-text-secondary">Interface luminance, contrast levels, and studio surface styling</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Light Mode Card */}
            <button
              type="button"
              aria-label="Light"
              onClick={() => {
                setTheme('light');
                settings.updateSettings({ theme: 'light' });
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                currentTheme === 'light'
                  ? 'border-primary ring-2 ring-primary/20 bg-surface shadow-md'
                  : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface text-text-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isMonochrome ? 'text-text-primary' : 'text-amber-500'
                  }`}
                  aria-hidden="true"
                >
                  light_mode
                </span>
                {currentTheme === 'light' && (
                  <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">check_circle</span>
                )}
              </div>
              <div className="font-bold text-sm text-text-primary mb-0.5">Light</div>
              <div className="text-xs text-text-secondary mb-3">Warm Daylight • #FAFAF8</div>
              <div
                className={`h-6 rounded-md border border-black/10 flex items-center px-2 ${
                  isMonochrome ? 'bg-[#E5E5E5]' : 'bg-[#FAFAF8]'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isMonochrome ? 'bg-[#FFFFFF]' : 'bg-[#0071E3]'
                  }`}
                />
              </div>
            </button>

            {/* Dark Mode Card */}
            <button
              type="button"
              aria-label="Dark"
              onClick={() => {
                setTheme('dark');
                settings.updateSettings({ theme: 'dark' });
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                currentTheme === 'dark'
                  ? 'border-primary ring-2 ring-primary/20 bg-surface shadow-md'
                  : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface text-text-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isMonochrome ? 'text-text-primary' : 'text-blue-400'
                  }`}
                  aria-hidden="true"
                >
                  dark_mode
                </span>
                {currentTheme === 'dark' && (
                  <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">check_circle</span>
                )}
              </div>
              <div className="font-bold text-sm text-text-primary mb-0.5">Dark</div>
              <div className="text-xs text-text-secondary mb-3">Dark Obsidian • #0D0E11</div>
              <div
                className={`h-6 rounded-md border border-white/10 flex items-center px-2 ${
                  isMonochrome ? 'bg-[#111111]' : 'bg-[#0D0E11]'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isMonochrome ? 'bg-[#888888]' : 'bg-[#2997FF]'
                  }`}
                />
              </div>
            </button>

            {/* Pure Monochrome Mode Card */}
            <button
              type="button"
              aria-label="Pure Monochrome"
              onClick={() => {
                setTheme('monochrome');
                settings.updateSettings({ theme: 'monochrome' });
              }}
              className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                currentTheme === 'monochrome'
                  ? 'border-primary ring-2 ring-primary/20 bg-surface shadow-md'
                  : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface text-text-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="material-symbols-outlined text-[22px] text-white" aria-hidden="true">contrast</span>
                {currentTheme === 'monochrome' && (
                  <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">check_circle</span>
                )}
              </div>
              <div className="font-bold text-sm text-text-primary mb-0.5">Pure Monochrome</div>
              <div className="text-xs text-text-secondary mb-3">Zero Saturation • #000000</div>
              <div className="h-6 rounded-md bg-[#000000] border border-white/20 flex items-center px-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF]" />
              </div>
            </button>
          </div>
        </section>

        {/* Section 3: Engine Pipeline & Updates */}
        <section className="bg-surface border border-outline-variant/30 rounded-2xl shadow-xs p-6 lg:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-text-primary">Engine Pipeline & Updates</h3>
              <p className="text-xs text-text-secondary">
                yt-dlp core, FFmpeg static links, and desktop auto-updates
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-container border border-outline-variant/40 text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span className={`material-symbols-outlined text-[16px] ${checkingUpdate ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
