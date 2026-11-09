// src/renderer/components/TopNavBar.tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore, type AppTheme } from '@/renderer/stores/themeStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';

interface TabItem {
  path: string;
  label: string;
  icon: JSX.Element;
}

const tabs: TabItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/video',
    label: 'Video',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: '/audio',
    label: 'Audio',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    path: '/playlist',
    label: 'Playlist',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10m4-4v6m3-3h-6" />
      </svg>
    ),
  },
  {
    path: '/clips',
    label: 'Clips',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242l2.879-2.879m0 0a3 3 0 114.242-4.242L12 7.758" />
      </svg>
    ),
  },
  {
    path: '/queue',
    label: 'Queue',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function TopNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const activeDownloadsCount = useDownloadStore((s) => {
    let count = 0;
    for (const item of s.downloads.values()) {
      if (item.status === 'downloading') count++;
    }
    return count;
  });

  const handleMinimize = () => (window as any).electronAPI?.minimize();
  const handleMaximize = () => (window as any).electronAPI?.maximize();
  const handleClose = () => (window as any).electronAPI?.close();

  return (
    <nav
      className="glass"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: '56px',
        margin: '12px 12px 0 12px',
        borderRadius: '16px',
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 100,
      } as any}
    >
      {/* Left section: macOS Traffic Lights & Brand Logo */}
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center gap-2">
          <button
            title="Close"
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] cursor-pointer transition-transform hover:brightness-110 active:scale-95 focus:outline-none"
          />
          <button
            title="Minimize"
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] cursor-pointer transition-transform hover:brightness-110 active:scale-95 focus:outline-none"
          />
          <button
            title="Maximize"
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] cursor-pointer transition-transform hover:brightness-110 active:scale-95 focus:outline-none"
          />
        </div>

        <div className="h-4 w-[1px] bg-[var(--border-hairline)]" />

        <div className="font-extrabold tracking-tight text-sm text-[var(--accent)] select-none">
          OFFLINER
        </div>
      </div>

      {/* Middle section: Navigation Tabs */}
      <div
        className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-hairline)]"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {tabs.map((tab) => {
          const isActive = activePath === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] font-medium'
              }`}
            >
              <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.path === '/queue' && activeDownloadsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--accent)] text-[var(--accent-text)]">
                  {activeDownloadsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right section: Tri-Theme Switcher Segmented Control */}
      <div
        className="flex items-center bg-[var(--bg-surface-elevated)] p-0.5 rounded-lg border border-[var(--border-hairline)]"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {(['light', 'dark', 'monochrome'] as const).map((t: AppTheme) => {
          const isCurrent = theme === t;
          const label = t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Monochrome';
          return (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-label={`Switch to ${label} theme`}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                isCurrent
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-medium'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

