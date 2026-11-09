// src/renderer/components/ProgressBar.tsx
import type { DownloadItem } from '@/types';

interface ProgressBarProps {
  download: DownloadItem;
  displayProgress?: number;
}

export default function ProgressBar({ download, displayProgress }: ProgressBarProps) {
  const progress = displayProgress !== undefined ? displayProgress : download.progress;
  const safeProgress = Math.min(100, Math.max(0, progress));
  
  const isDone = download.status === 'done';
  const transition = isDone ? 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'width 3s linear';

  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden border border-[var(--border-hairline)]"
      style={{
        background: 'var(--bg-surface-elevated)',
      }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${safeProgress}%`,
          background: 'var(--accent)',
          transition: transition,
        }}
      />
    </div>
  );
}

