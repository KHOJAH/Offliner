// src/renderer/components/TopNavBar.tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '@/renderer/stores/themeStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
}

const studioResolvers: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/video', label: 'Video', icon: 'smart_display' },
  { path: '/audio', label: 'Audio', icon: 'graphic_eq' },
  { path: '/playlist', label: 'Playlist', icon: 'queue_music' },
  { path: '/clips', label: 'Clips', icon: 'content_cut' },
];

export default function TopNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const activeCount = useDownloadStore((s) => {
    let count = 0;
    for (const item of s.downloads.values()) {
      if (item.status === 'downloading') count++;
    }
    return count;
  });

  const queueTotal = useDownloadStore((s) => {
    let count = 0;
    for (const item of s.downloads.values()) {
      if (item.status === 'downloading' || item.status === 'queued') count++;
    }
    return count;
  });

  const handleMinimize = () => (window as any).electronAPI?.minimize();
  const handleMaximize = () => (window as any).electronAPI?.maximize();
  const handleClose = () => (window as any).electronAPI?.close();

  const queueItems: NavItem[] = [
    {
      path: '/queue',
      label: 'Queue',
      icon: 'downloading',
      badge: activeCount > 0 ? `${activeCount} Active` : undefined,
    },
    { path: '/settings', label: 'Settings', icon: 'tune' },
  ];

  return (
    <>
      {/* ─── Stitch Studio Sidebar (Left Aside) ─── */}
      <aside
        className="fixed left-0 top-0 h-full w-64 bg-surface-container-low/95 backdrop-blur-xl z-50 flex flex-col pt-4 pb-6 shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-r border-outline-variant/15 select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* macOS Traffic Lights & Title */}
        <div className="h-10 px-5 flex items-center gap-2 mb-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            title="Close"
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-traffic-close shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
          />
          <button
            title="Minimize"
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-traffic-min shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
          />
          <button
            title="Maximize"
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full bg-traffic-max shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
          />
          <span className="ml-3 font-semibold text-text-primary tracking-tight text-sm">
            OFFLINER
          </span>
          <span className="ml-auto text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface text-text-secondary border border-outline-variant/20 shadow-xs">
            v2.4
          </span>
        </div>

        {/* Section: Library */}
        <div className="px-4 mb-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold px-2">
            Library
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {studioResolvers.map((item) => {
            const isActive = activePath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center px-3 py-2 rounded-lg transition-all text-left text-sm font-medium ${
                  isActive
                    ? 'bg-surface text-primary shadow-[0_2px_8px_rgba(0,0,0,0.04)] font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] mr-2.5 text-text-secondary" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Section: Activity */}
          <div className="pt-4 pb-2 px-2">
            <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
              Activity
            </span>
          </div>

          {queueItems.map((item) => {
            const isActive = activePath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left text-sm font-medium ${
                  isActive
                    ? 'bg-surface text-primary shadow-[0_2px_8px_rgba(0,0,0,0.04)] font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center min-w-0">
                  <span className="material-symbols-outlined text-[18px] mr-2.5 text-text-secondary" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-2">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Bandwidth Speed */}
        <div className="px-4 pt-4 mt-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="bg-surface rounded-xl p-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-outline-variant/15">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-text-secondary font-medium">Download Speed</span>
              <span className="text-[11px] font-mono text-text-primary font-medium">
                {activeCount > 0 ? `${(activeCount * 14.2).toFixed(1)} MB/s` : '0.0 MB/s'}
              </span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div
                className={`bg-primary h-full rounded-full transition-all duration-500 ${
                  activeCount > 0 ? 'w-3/4 animate-pulse' : 'w-full'
                }`}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Stitch Top Studio Header ─── */}
      <header
        className="fixed top-0 left-64 right-0 h-16 bg-surface/85 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-outline-variant/15 flex items-center justify-between px-8 select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-text-secondary border border-outline-variant/15">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs font-medium text-on-surface">Ready</span>
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Tri-Theme Switcher Pill Group */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-1 border border-outline-variant/15">
            <button
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                theme === 'light'
                  ? 'bg-surface text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
              title="Light Appearance"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">light_mode</span>
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                theme === 'dark'
                  ? 'bg-surface text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
              title="Dark Appearance"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">dark_mode</span>
              Dark
            </button>
            <button
              onClick={() => setTheme('monochrome')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                theme === 'monochrome'
                  ? 'bg-surface text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : 'text-text-secondary hover:text-on-surface'
              }`}
              title="Mono Contrast"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">contrast</span>
              Mono
            </button>
          </div>

          {/* Queued Items Indicator Pill */}
          <div className="flex items-center gap-2 pl-2">
            <button
              onClick={() => navigate('/queue')}
              className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/15 hover:bg-surface-container transition-colors cursor-pointer"
              title="Open Queue"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">sync</span>
              <span className="text-xs font-mono text-text-primary font-medium">
                {queueTotal} queued
              </span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
