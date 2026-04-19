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
  const transition = isDone ? 'width 0.3s ease' : 'width 3s linear';

  return (
    <div style={{
      width: '100%',
      height: 8,
      background: 'rgba(255,255,255,0.1)',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${safeProgress}%`,
        height: '100%',
        background: `linear-gradient(90deg, #6366F1, #8B5CF6)`,
        borderRadius: 4,
        transition: transition,
      }} />
    </div>
  );
}
