// src/renderer/views/QueueView.tsx
import { useState, memo } from 'react';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import DownloadCard from '@/renderer/components/DownloadCard';

interface SectionProps {
  title: string;
  icon: string;
  items: any[];
  opacity?: number;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const QueueSection = memo(
  ({ title, icon, items, opacity = 1, isCollapsible = false, isCollapsed = false, onToggle }: SectionProps) => {
    if (items.length === 0) return null;

    return (
      <section className="space-y-3" style={{ opacity }}>
        <div
          className="flex items-center justify-between pb-1 border-b border-outline-variant/15 select-none cursor-pointer"
          onClick={isCollapsible ? onToggle : undefined}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
            <h3 className="font-semibold text-sm text-text-primary m-0">{title}</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-container text-text-secondary font-medium">
              {items.length}
            </span>
          </div>
          {isCollapsible && (
            <span
              className={`material-symbols-outlined text-[18px] text-text-tertiary transition-transform ${
                isCollapsed ? '-rotate-90' : ''
              }`}
            >
              expand_more
            </span>
          )}
        </div>

        {!isCollapsed && (
          <div className="space-y-3 pt-1">
            {items.map((d) => (
              <div key={d.id} className="space-y-1">
                <DownloadCard download={d} />
                {d.errorMessage && d.status === 'error' && (
                  <div className="p-3 rounded-b-xl text-xs font-mono text-status-error bg-status-error/5 border border-t-0 border-status-error/20">
                    {d.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }
);

export default function QueueView() {
  const downloads = useDownloadStore((s) => s.downloads);
  const clearFinishedDownloads = useDownloadStore((s) => s.clearFinishedDownloads);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);

  const downloadList = Array.from(downloads.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  const active = downloadList.filter((d) => d.status === 'downloading' || d.status === 'paused');
  const queued = downloadList.filter((d) => d.status === 'queued');
  const done = downloadList.filter((d) => d.status === 'done');
  const cancelled = downloadList.filter((d) => d.status === 'cancelled');
  const errors = downloadList.filter((d) => d.status === 'error');

  const pauseAll = () => {
    for (const d of active) {
      if (d.status === 'downloading') {
        pauseDownload(d.id);
      }
    }
  };

  const resumeAll = () => {
    for (const d of active) {
      if (d.status === 'paused') {
        resumeDownload(d.id);
      }
    }
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const totalSpeed = active
    .filter((d) => d.status === 'downloading')
    .reduce((acc, curr) => acc + (curr.speed ? parseFloat(curr.speed) || 14.2 : 14.2), 0);

  return (
    <div className="flex flex-col w-full">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* Top Context & Global Action Toolbar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-outline-variant/15">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Transfers
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                arrow_downward
              </span>
              <span className="font-semibold text-text-primary">
                {active.length > 0 ? `${totalSpeed.toFixed(1)} MB/s` : '0.0 MB/s'}
              </span>
              <span>• {active.length} active</span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={pauseAll}
              className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/30 hover:bg-surface-container transition-colors text-xs font-medium text-text-primary flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">pause</span>
              <span>Pause All</span>
            </button>
            <button
              type="button"
              onClick={resumeAll}
              className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/30 hover:bg-surface-container transition-colors text-xs font-medium text-text-primary flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Resume All</span>
            </button>
            <button
              type="button"
              onClick={clearFinishedDownloads}
              className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/30 hover:bg-surface-container transition-colors text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">clear_all</span>
              <span>Clear Finished</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {downloadList.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3 bg-surface border border-outline-variant/30 rounded-2xl p-8">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-text-secondary">
              <span className="material-symbols-outlined text-3xl">downloading</span>
            </div>
            <h3 className="text-base font-bold text-text-primary">No Downloads</h3>
            <p className="text-xs text-text-secondary max-w-sm">
              Items you download will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Active Transfers */}
            <QueueSection
              title="Active"
              icon="downloading"
              items={active}
              isCollapsible
              isCollapsed={collapsedSections['Active']}
              onToggle={() => toggleSection('Active')}
            />

            {/* Queued Ingestion */}
            <QueueSection
              title="Queued"
              icon="hourglass_top"
              items={queued}
              isCollapsible
              isCollapsed={collapsedSections['Queued']}
              onToggle={() => toggleSection('Queued')}
            />

            {/* Completed */}
            <QueueSection
              title="Completed"
              icon="check_circle"
              items={done}
              isCollapsible
              isCollapsed={collapsedSections['Completed']}
              onToggle={() => toggleSection('Completed')}
            />

            {/* Failed */}
            <QueueSection
              title="Failed"
              icon="report_problem"
              items={errors}
              isCollapsible
              isCollapsed={collapsedSections['Failed']}
              onToggle={() => toggleSection('Failed')}
            />

            {/* Deleted / Cancelled */}
            <QueueSection
              title="Deleted"
              icon="cancel"
              items={cancelled}
              opacity={0.7}
              isCollapsible
              isCollapsed={collapsedSections['Deleted']}
              onToggle={() => toggleSection('Deleted')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
