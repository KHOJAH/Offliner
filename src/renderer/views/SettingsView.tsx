import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore } from '@/renderer/stores/themeStore';
import { useUIStore } from '@/renderer/stores/uiStore';
import { ipcClient } from '@/renderer/ipc/client';

export default function SettingsView() {
  const settings = useSettingsStore();
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const addToast = useUIStore((s) => s.addToast);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
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
    const info = await ipcClient.checkForUpdates();
    if (info) {
      setUpdateInfo(info);
      addToast({ type: 'info', title: 'Update available', message: `Version ${info.version}` });
    } else {
      addToast({ type: 'info', title: 'Up to date', message: 'You have the latest version.' });
    }
    setCheckingUpdate(false);
  };

  const applyTheme = (themeName: 'light' | 'dark' | 'monochrome') => {
    setTheme(themeName);
    settings.updateSettings({ theme: themeName });
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
          Settings
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Manage system engine parameters, storage destinations, and visual architectural themes.
        </p>
      </div>

      <div className="space-y-6">
        {/* Group 1: General & Storage */}
        <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
            General & Storage
          </h4>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                DOWNLOAD LOCATION
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.downloadPath}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] text-xs sm:text-sm font-mono text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={handleSelectPath}
                  className="btn px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  Browse
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  CONCURRENT DOWNLOADS: {settings.concurrency}
                </label>
                <span className="text-xs font-mono font-bold text-[var(--accent)]">
                  {settings.concurrency} worker{settings.concurrency > 1 ? 's' : ''} (Max 8)
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={settings.concurrency}
                onChange={(e) => settings.updateSettings({ concurrency: Number(e.target.value) })}
                className="w-full h-2 rounded-lg cursor-pointer appearance-none bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] accent-[var(--accent)]"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-tertiary)] mt-1.5">
                <span>1 (Serial)</span>
                <span>3 (Default)</span>
                <span>8 (Aggressive)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Group 2: Appearance & Theme Swatches */}
        <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Appearance & Themes
            </h4>
            <span className="text-xs font-mono font-semibold text-[var(--accent)] capitalize">
              Active: {currentTheme}
            </span>
          </div>

          <div className="space-y-4">
            {/* 3 Architectural Theme Preview Swatches */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Swatch 1: Light Mode (Warm Daylight) */}
              <div
                onClick={() => applyTheme('light')}
                data-theme-preview="light"
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'light'
                    ? 'border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/30'
                    : 'border-[var(--border-hairline)] hover:border-[var(--text-tertiary)]'
                }`}
                style={{ background: '#FAFAF8', color: '#1D1D1F' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#0071E3' }} />
                  <span className="text-[10px] font-mono uppercase font-bold text-[#6E6E73]">Daylight</span>
                </div>
                <div className="font-bold text-sm mb-0.5">Warm Daylight</div>
                <div className="text-[11px] text-[#6E6E73]">Apple Clean • High Contrast</div>
              </div>

              {/* Swatch 2: Dark Mode (Dark Obsidian) */}
              <div
                onClick={() => applyTheme('dark')}
                data-theme-preview="dark"
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'dark'
                    ? 'border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/30'
                    : 'border-[var(--border-hairline)] hover:border-[var(--text-tertiary)]'
                }`}
                style={{ background: '#0D0E11', color: '#F5F5F7' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#2997FF' }} />
                  <span className="text-[10px] font-mono uppercase font-bold text-[#86868B]">Obsidian</span>
                </div>
                <div className="font-bold text-sm mb-0.5">Dark Obsidian</div>
                <div className="text-[11px] text-[#86868B]">OLED Pitch • Deep Focus</div>
              </div>

              {/* Swatch 3: Pure Monochrome */}
              <div
                onClick={() => applyTheme('monochrome')}
                data-theme-preview="monochrome"
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  currentTheme === 'monochrome'
                    ? 'border-white shadow-md ring-2 ring-white/30'
                    : 'border-[#262626] hover:border-[#666666]'
                }`}
                style={{ background: '#000000', color: '#FFFFFF' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-4 h-4 rounded-full bg-white" />
                  <span className="text-[10px] font-mono uppercase font-bold text-[#9E9E9E]">0% Chroma</span>
                </div>
                <div className="font-bold text-sm mb-0.5">Pure Monochrome</div>
                <div className="text-[11px] text-[#9E9E9E]">Strict R=G=B Noir</div>
              </div>
            </div>

            {/* Accessible Segmented Theme Buttons */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                THEME
              </label>
              <div className="flex gap-2">
                {(['light', 'dark', 'monochrome'] as const).map((themeName) => (
                  <button
                    key={themeName}
                    type="button"
                    className={currentTheme === themeName ? 'btn btn-primary' : 'btn'}
                    onClick={() => applyTheme(themeName)}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Group 3: Engine & Formats */}
        <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
            Engine & Pipeline Architecture
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
              <div className="font-bold text-sm text-[var(--text-primary)] mb-1">DASH Stream Multiplexing</div>
              <div className="text-[var(--text-secondary)] leading-relaxed">
                Automatically extracts and merges best quality video (AV1/VP9) and pristine audio streams into MP4/MKV.
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
              <div className="font-bold text-sm text-[var(--text-primary)] mb-1">Keyframe-Snapping Trimmer</div>
              <div className="text-[var(--text-secondary)] leading-relaxed">
                Enforces <code className="font-mono text-[var(--accent)]">--force-keyframes-at-cuts</code> and soft seeks for glitch-free clip rendering.
              </div>
            </div>
          </div>
        </div>

        {/* Group 4: Application & System Updates */}
        <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-4">
            Application
          </h4>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Software Update</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Current Version: {appVersion} • Native Execution Layer
              </div>
            </div>
            <div className="flex items-center gap-3">
              {updateInfo && (
                <span className="text-xs font-mono font-bold text-[var(--success)]">
                  v{updateInfo.version} Available
                </span>
              )}
              <button 
                type="button"
                className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95" 
                onClick={handleCheckUpdate} 
                disabled={checkingUpdate}
              >
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

