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
    <section style={{ marginBottom: 32, opacity }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          gap: 12, 
          marginBottom: 12,
          cursor: isCollapsible ? 'pointer' : 'default',
          userSelect: 'none'
        }}
        onClick={isCollapsible ? onToggle : undefined}
      >
        {isCollapsible ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              fontSize: 10, 
              color: 'var(--text-tertiary)',
              transform: isCollapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.2s ease',
              display: 'inline-block'
            }}>
              ▼
            </span>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h4>
          </div>
        ) : (
          <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h4>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{items.length}</span>
      </div>
      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((d) => (
            <div key={d.id}>
              <DownloadCard download={d} />
              {d.errorMessage && d.status === 'error' && (
                <div className="glass" style={{ 
                  marginTop: -8, 
                  padding: '16px 16px 12px 116px', 
                  fontSize: 12, 
                  color: 'var(--error)', 
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderTop: 'none',
                  background: 'rgba(255, 59, 48, 0.05)',
                  fontWeight: 500
                }}>
                  {d.errorMessage}
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
  const downloadList = Array.from(downloads.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const active = downloadList.filter((d) => d.status === 'downloading' || d.status === 'paused');
  const queued = downloadList.filter((d) => d.status === 'queued');
  const done = downloadList.filter((d) => d.status === 'done');
  const cancelled = downloadList.filter((d) => d.status === 'cancelled');
  const errors = downloadList.filter((d) => d.status === 'error');

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Queue</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Manage your active and completed downloads
            </p>
          </div>
          <button
            onClick={clearFinishedDownloads}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            Clear Finished
          </button>
        </div>

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

        {downloadList.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '120px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{ 
              width: 64, 
              height: 64, 
              borderRadius: '50%', 
              background: 'rgba(128,128,128,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: 'var(--text-tertiary)'
            }}>
              ↓
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Downloads</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Items you download will appear here.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
