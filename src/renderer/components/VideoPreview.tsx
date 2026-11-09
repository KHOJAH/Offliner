// src/renderer/components/VideoPreview.tsx
import type { VideoMetadata } from '@/types';

interface VideoPreviewProps {
  metadata: VideoMetadata;
}

export default function VideoPreview({ metadata }: VideoPreviewProps) {
  const duration = formatDuration(metadata.duration);

  return (
    <div className="flex flex-col gap-4">
      {/* 16:9 Thumbnail with duration overlay */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] shadow-sm group">
        <img
          src={metadata.thumbnail}
          alt={metadata.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-black/70 text-white backdrop-blur-xs">
          DASH Stream
        </div>
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-black/80 text-white backdrop-blur-xs">
          {duration}
        </div>
      </div>

      {/* Metadata & Channel Info */}
      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug mb-2 line-clamp-2">
          {metadata.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] flex-wrap">
          {metadata.uploader && (
            <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              {metadata.uploader}
            </span>
          )}
          {metadata.view_count ? (
            <span>• {formatNumber(metadata.view_count)} views</span>
          ) : null}
          <span>• {duration}</span>
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

