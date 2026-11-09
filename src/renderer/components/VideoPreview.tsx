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
        {duration && (
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums bg-black/70 text-white backdrop-blur-md shadow-xs">
            {duration}
          </div>
        )}
      </div>

      {/* Metadata & Channel Info */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)] leading-snug mb-1.5 line-clamp-2">
          {metadata.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] flex-wrap">
          {metadata.uploader && (
            <span className="font-medium text-[var(--text-primary)]">
              {metadata.uploader}
            </span>
          )}
          {metadata.uploader && metadata.view_count ? (
            <span className="text-[var(--text-tertiary)]">•</span>
          ) : null}
          {metadata.view_count ? (
            <span>{formatNumber(metadata.view_count)} views</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
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

