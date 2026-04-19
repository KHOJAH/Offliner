// src/renderer/components/VideoPreview.tsx
import type { VideoMetadata } from '@/types';

interface VideoPreviewProps {
  metadata: VideoMetadata;
}

export default function VideoPreview({ metadata }: VideoPreviewProps) {
  const duration = formatDuration(metadata.duration);

  return (
    <div className="glass" style={{
      display: 'flex',
      gap: 16,
      padding: 16,
      alignItems: 'flex-start',
    }}>
      <img
        src={metadata.thumbnail}
        alt={metadata.title}
        style={{
          width: 160,
          borderRadius: 10,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{metadata.title}</h3>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>👤 {metadata.uploader}</span>
          <span>⏱️ {duration}</span>
          {metadata.view_count && <span>👁️ {formatNumber(metadata.view_count)} views</span>}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
