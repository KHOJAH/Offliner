import { useState, memo } from 'react';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import DownloadCard from '@/renderer/components/DownloadCard';

interface SectionProps {
  title: string;
  items: any[];
  opacity?: number;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Section = memo(({ 
  title, 
  items, 
  opacity = 1, 
  isCollapsible = false, 
  isCollapsed = false, 
  onToggle 
}: SectionProps) => {
  if (items.length === 0) return null;
  return (
    <section className="mb-8" style={{ opacity }}>
      <div 
        className={`flex items-center justify-between mb-3 select-none ${isCollapsible ? 'cursor-pointer' : ''}`}
        onClick={isCollapsible ? onToggle : undefined}
      >
        <div className="flex items-center gap-2.5">
          {isCollapsible && (
            <span
              className={`text-[10px] text-[var(--text-tertiary)] transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            >
              ▼
            </span>
          )}
          <h4 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
            {title}
          </h4>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
            {items.length}
          </span>
        </div>

        {isCollapsible && (
          <span className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            {isCollapsed ? 'Expand' : 'Collapse'}
          </span>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-3">
          {items.map((d) => (
            <div key={d.id} className="flex flex-col">
              <DownloadCard download={d} />
              {d.errorMessage && d.status === 'error' && (
                <div className="mx-4 -mt-2 p-3 rounded-b-xl text-xs font-medium bg-[var(--error)]/10 text-[var(--error)] border-x border-b border-[var(--error)]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Error:</span>
                    <span>{d.errorMessage}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

export default function QueueView() {
  const downloads = useDownloadStore((s) => s.downloads);
  const clearFinishedDownloads = useDownloadStore((s) => s.clearFinishedDownloads);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);

  const downloadList = Array.from(downloads.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const active = downloadList.filter((d) => d.status === 'downloading' || d.status === 'paused');
  const downloadingItems = downloadList.filter((d) => d.status === 'downloading');
  const pausedItems = downloadList.filter((d) => d.status === 'paused');
  const queued = downloadList.filter((d) => d.status === 'queued');
  const done = downloadList.filter((d) => d.status === 'done');
  const cancelled = downloadList.filter((d) => d.status === 'cancelled');
  const errors = downloadList.filter((d) => d.status === 'error');

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handlePauseAll = async () => {
    for (const item of downloadingItems) {
      await pauseDownload(item.id);
    }
  };

  const handleResumeAll = async () => {
    for (const item of pausedItems) {
      await resumeDownload(item.id);
    }
  };

  // Calculate live aggregate speed
  const totalSpeedBps = downloadingItems.reduce((acc, curr) => acc + (curr.speedBps || 0), 0);
  const formatSpeed = (bps: number) => {
    if (bps === 0) return '0.00 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let val = bps;
    let unit = 0;
    while (val > 1024 && unit < units.length - 1) {
      val /= 1024;
      unit++;
    }
    return `${val.toFixed(2)} ${units[unit]}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4">
      {/* Session Toolbar Header */}
      <div className="glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
              Engine Stream // Active Session
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Transfers Download Queue
          </h2>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] font-mono mt-1">
            <span className="text-[var(--accent)] font-semibold">{formatSpeed(totalSpeedBps)}</span>
            <span>•</span>
            <span>{downloadingItems.length} Active Pipes</span>
            <span>•</span>
            <span>{downloadList.length} Total Jobs</span>
          </div>
        </div>

        {/* Global Batch Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePauseAll}
            disabled={downloadingItems.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              downloadingItems.length === 0
                ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-elevated)] border-[var(--border-hairline)] text-[var(--text-tertiary)]'
                : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-hairline)] text-[var(--text-primary)] cursor-pointer active:scale-95'
            }`}
          >
            Pause All
          </button>
          <button
            type="button"
            onClick={handleResumeAll}
            disabled={pausedItems.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              pausedItems.length === 0
                ? 'opacity-50 cursor-not-allowed bg-[var(--bg-surface-elevated)] border-[var(--border-hairline)] text-[var(--text-tertiary)]'
                : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-hairline)] text-[var(--accent)] cursor-pointer active:scale-95'
            }`}
          >
            Resume All
          </button>
          <button
            type="button"
            onClick={clearFinishedDownloads}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95"
          >
            Clear Finished
          </button>
        </div>
      </div>

      {/* Categorized Queue Sections */}
      <Section title="Active" items={active} />
      <Section title="Queued" items={queued} />
      <Section 
        title="Completed" 
        items={done} 
        opacity={0.85} 
        isCollapsible 
        isCollapsed={collapsedSections['Completed'] || false}
        onToggle={() => toggleSection('Completed')}
      />
      <Section 
        title="Deleted" 
        items={cancelled} 
        opacity={0.6} 
        isCollapsible 
        isCollapsed={collapsedSections['Deleted'] || false}
        onToggle={() => toggleSection('Deleted')}
      />
      <Section 
        title="Failed" 
        items={errors} 
        isCollapsible 
        isCollapsed={collapsedSections['Failed'] || false}
        onToggle={() => toggleSection('Failed')}
      />

      {/* Empty State */}
      {downloadList.length === 0 && (
        <div className="glass rounded-2xl p-16 border border-[var(--border-hairline)] text-center flex flex-col items-center justify-center gap-4 my-12">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-tertiary)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--text-primary)] mb-1">No Downloads</div>
            <div className="text-xs sm:text-sm text-[var(--text-secondary)]">Items you download will appear here.</div>
          </div>
        </div>
      )}
    </div>
  );
}

