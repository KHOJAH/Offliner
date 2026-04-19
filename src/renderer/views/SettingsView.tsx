// src/renderer/views/SettingsView.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { ipcClient } from '@/ipc/client';

export default function SettingsView() {
  const settings = useSettingsStore();
  const addToast = useUIStore((s) => s.addToast);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

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

  return (
    <div className="page-container">
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 32, fontSize: 28, fontWeight: 700 }}>Settings</h2>

        <div className="glass" style={{ padding: 24, marginBottom: 20, borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 16, fontSize: 16 }}>General</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                DOWNLOAD LOCATION
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={settings.downloadPath}
                  readOnly
                  className="input"
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <button className="btn" onClick={handleSelectPath} style={{ minWidth: 90 }}>Browse</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 24 }}>
               <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                    CONCURRENT DOWNLOADS: {settings.concurrency}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={settings.concurrency}
                    onChange={(e) => settings.updateSettings({ concurrency: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }}
                  />
               </div>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: 24, marginBottom: 20, borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 16, fontSize: 16 }}>Appearance</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', color: 'var(--text-secondary)' }}>
              THEME
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['dark', 'light'] as const).map((theme) => (
                <button
                  key={theme}
                  className={settings.theme === theme ? 'btn btn-primary' : 'btn'}
                  onClick={() => settings.updateSettings({ theme })}
                  style={{ flex: 1, padding: '10px' }}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ marginBottom: 16, fontSize: 16 }}>Application</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Software Update</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Current Version: 0.1.0
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {updateInfo && (
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  v{updateInfo.version} Available
                </span>
              )}
              <button 
                className="btn btn-primary" 
                onClick={handleCheckUpdate} 
                disabled={checkingUpdate}
                style={{ borderRadius: 'var(--radius-xl)', padding: '8px 20px' }}
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
