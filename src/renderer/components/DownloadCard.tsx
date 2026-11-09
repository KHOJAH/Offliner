import { useState, useEffect, useRef, memo, useCallback } from 'react';
import type { DownloadItem } from '@/types';
import { useDownloadStore } from '@/stores/downloadStore';
import ProgressBar from './ProgressBar';
import { ipcClient } from '@/ipc/client';

interface DownloadCardProps {
  download: DownloadItem;
}

// Separate memoized component for stats to prevent fast flickering
const StatsRow = memo(({ 
  progress, 
  speed, 
  eta, 
  downloadedBytes, 
  totalBytes, 
  status, 
  isActive, 
  isCompleted 
}: { 
  progress: number, 
  speed: string, 
  eta: string, 
  downloadedBytes?: number, 
  totalBytes?: number, 
  status: string, 
  isActive: boolean, 
  isCompleted: boolean 
}) => {
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let val = bytes;
    let unit = 0;
    while (val > 1024 && unit < units.length - 1) {
      val /= 1024;
      unit++;
    }
    return `${val.toFixed(1)} ${units[unit]}`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'done':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--success)]">Completed</span>;
      case 'downloading':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--accent)]">Downloading</span>;
      case 'paused':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--warning)]">Paused</span>;
      case 'queued':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Queued</span>;
      case 'error':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--error)]">Failed</span>;
      case 'cancelled':
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">Cancelled</span>;
      default:
        return <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">{status}</span>;
    }
  };

  return (
    <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-secondary)] font-mono">
      <div className="flex items-center gap-3">
        <span className="text-[var(--accent)] font-semibold tabular-nums">{progress.toFixed(1)}%</span>
        {isActive && (
          <>
            <span className="tabular-nums">{speed || '0 KB/s'}</span>
            {eta && <span className="tabular-nums">ETA {eta}</span>}
          </>
        )}
        {!isCompleted && totalBytes ? (
          <span className="tabular-nums">{formatSize(downloadedBytes)} / {formatSize(totalBytes)}</span>
        ) : null}
        {isCompleted && totalBytes ? (
          <span className="tabular-nums">{formatSize(totalBytes)}</span>
        ) : null}
      </div>
      
      <div>
        {getStatusBadge()}
      </div>
    </div>
  );
});

// Memoized buttons to prevent flickering/flashing
const ActionButtons = memo(({ 
  status, 
  id, 
  onPause, 
  onResume, 
  onCancel, 
  onRemove, 
  onOpen, 
  onShow 
}: { 
  status: string, 
  id: string, 
  onPause: (id: string) => void,
  onResume: (id: string) => void,
  onCancel: (id: string) => void,
  onRemove: (id: string) => void,
  onOpen: () => void,
  onShow: () => void
}) => {
  const isCompleted = status === 'done';
  
  return (
    <div className="flex items-center gap-2 shrink-0">
      {isCompleted && (
        <>
          <button 
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
            onClick={onOpen}
          >
            Open
          </button>
          <button 
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
            onClick={onShow}
          >
            Show Folder
          </button>
          <button 
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--error)]/10 hover:bg-[var(--error)]/20 text-[var(--error)] border border-[var(--error)]/20 transition-all cursor-pointer active:scale-95" 
            onClick={() => onRemove(id)}
          >
            Delete
          </button>
        </>
      )}
      
      {status === 'downloading' && (
        <button 
          className="px-3 py-1.5 min-w-[70px] rounded-xl text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
          onClick={() => onPause(id)}
        >
          Pause
        </button>
      )}
      {status === 'paused' && (
        <button 
          className="px-3 py-1.5 min-w-[70px] rounded-xl text-xs font-semibold bg-[var(--accent)] hover:brightness-105 text-[var(--accent-text)] transition-all cursor-pointer active:scale-95 shadow-sm" 
          onClick={() => onResume(id)}
        >
          Resume
        </button>
      )}
      {(status === 'downloading' || status === 'paused' || status === 'queued') && (
        <button 
          className="px-3 py-1.5 min-w-[70px] rounded-xl text-xs font-semibold bg-[var(--error)]/10 hover:bg-[var(--error)]/20 text-[var(--error)] border border-[var(--error)]/20 transition-all cursor-pointer active:scale-95" 
          onClick={() => onCancel(id)}
        >
          Cancel
        </button>
      )}
      {(status === 'cancelled' || status === 'error') && (
        <button 
          className="px-3 py-1.5 min-w-[70px] rounded-xl text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
          onClick={() => onRemove(id)}
        >
          Remove
        </button>
      )}
    </div>
  );
});

const DownloadCard = memo(({ download }: DownloadCardProps) => {
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);
  const removePermanent = useDownloadStore((s) => s.removePermanent);

  // Stats Display State (Updated every 3s - Feature #23)
  const [displayStats, setDisplayStats] = useState({
    speed: download.speed || '',
    eta: download.eta || '',
    progress: download.progress,
    downloadedBytes: download.downloadedBytes
  });

  const samplesRef = useRef<{ speed: number[]; eta: number[] }>({ speed: [], eta: [] });
  const latestDataRef = useRef(download);

  useEffect(() => {
    latestDataRef.current = download;
    if (download.status === 'downloading') {
      if (download.speedBps !== undefined) samplesRef.current.speed.push(download.speedBps);
      if (download.etaSeconds !== undefined) samplesRef.current.eta.push(download.etaSeconds);
    }
  }, [download]);

  const formatSpeed = (bps: number) => {
    if (bps === 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let val = bps;
    let unit = 0;
    while (val > 1024 && unit < units.length - 1) {
      val /= 1024;
      unit++;
    }
    return `${val.toFixed(2)} ${units[unit]}`;
  };

  const formatETA = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 3s UI Update Interval (Feature #23 Progress Metric Smoothing)
  useEffect(() => {
    if (download.status !== 'downloading') {
      setDisplayStats({
        speed: download.speed || '',
        eta: download.eta || '',
        progress: download.progress,
        downloadedBytes: download.downloadedBytes
      });
      return;
    }

    const interval = setInterval(() => {
      const speedSamples = samplesRef.current.speed;
      const etaSamples = samplesRef.current.eta;

      let nextSpeed = latestDataRef.current.speed || '';
      let nextEta = latestDataRef.current.eta || '';

      if (speedSamples.length > 0) {
        const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
        nextSpeed = formatSpeed(avgSpeed);
        samplesRef.current.speed = [];
      }

      if (etaSamples.length > 0) {
        const avgETA = etaSamples.reduce((a, b) => a + b, 0) / etaSamples.length;
        nextEta = formatETA(avgETA);
        samplesRef.current.eta = [];
      }
      
      setDisplayStats({
        speed: nextSpeed,
        eta: nextEta,
        progress: latestDataRef.current.progress,
        downloadedBytes: latestDataRef.current.downloadedBytes
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [download.status]);

  // Stable Callbacks for Buttons
  const onPause = useCallback((id: string) => pauseDownload(id), [pauseDownload]);
  const onResume = useCallback((id: string) => resumeDownload(id), [resumeDownload]);
  const onCancel = useCallback((id: string) => cancelDownload(id), [cancelDownload]);
  const onRemove = useCallback((id: string) => removePermanent(id), [removePermanent]);
  const onOpen = useCallback(() => { if (download.filePath) ipcClient.openFile(download.filePath); }, [download.filePath]);
  const onShow = useCallback(() => { if (download.filePath) ipcClient.showInFolder(download.filePath); }, [download.filePath]);

  const isCompleted = download.status === 'done';
  const isError = download.status === 'error';
  const isActive = download.status === 'downloading' || download.status === 'paused';
  const formatTag = download.config?.audioFormat?.toUpperCase() || download.config?.format || (download.config?.clips?.length ? 'CLIP' : undefined);

  return (
    <div className="glass flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-[var(--border-hairline)] shadow-sm hover:shadow-md transition-all">
      {/* Thumbnail with overlay badges */}
      <div className="relative w-28 h-16 rounded-xl overflow-hidden shrink-0 bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
        <img
          src={download.thumbnail}
          alt={download.title}
          className="w-full h-full object-cover"
        />
        {formatTag && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-black/75 text-white backdrop-blur-xs">
            {formatTag}
          </span>
        )}
        {isError && (
          <div className="absolute inset-0 bg-[var(--error)]/40 backdrop-blur-xs flex items-center justify-center text-white font-bold text-lg">
            !
          </div>
        )}
      </div>

      {/* Middle content: Title, Badges, Progress, Stats */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {download.title}
          </div>
          {formatTag && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium uppercase bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-hairline)] shrink-0">
              {formatTag}
            </span>
          )}
        </div>
        
        {/* Smooth real-time Progress Bar */}
        <ProgressBar download={download} />
        
        {/* 3s Rolling Average Stats */}
        <StatsRow 
          progress={displayStats.progress}
          speed={displayStats.speed}
          eta={displayStats.eta}
          downloadedBytes={displayStats.downloadedBytes}
          totalBytes={download.totalBytes}
          status={download.status}
          isActive={isActive}
          isCompleted={isCompleted}
        />
      </div>

      {/* Actions */}
      <ActionButtons 
        status={download.status}
        id={download.id}
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
        onRemove={onRemove}
        onOpen={onOpen}
        onShow={onShow}
      />
    </div>
  );
});

export default DownloadCard;

