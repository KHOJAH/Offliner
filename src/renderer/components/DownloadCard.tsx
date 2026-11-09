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
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--success)]/10 text-[var(--success)]">
            Completed
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
            Downloading
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--warning)]/10 text-[var(--warning)]">
            Paused
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]">
            Queued
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--error)]/10 text-[var(--error)]">
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex items-center justify-between mt-2.5 text-xs text-[var(--text-secondary)]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[var(--accent)] font-semibold font-mono tabular-nums">{progress.toFixed(1)}%</span>
        {isActive && (
          <>
            <span className="font-mono tabular-nums">{speed || '0 KB/s'}</span>
            {eta && <span className="font-mono tabular-nums">ETA {eta}</span>}
          </>
        )}
        {!isCompleted && totalBytes ? (
          <span className="font-mono tabular-nums">{formatSize(downloadedBytes)} / {formatSize(totalBytes)}</span>
        ) : null}
        {isCompleted && totalBytes ? (
          <span className="font-mono tabular-nums">{formatSize(totalBytes)}</span>
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
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[var(--accent)] hover:opacity-90 text-[var(--accent-text)] transition-all cursor-pointer active:scale-95 shadow-xs" 
            onClick={onOpen}
          >
            Open
          </button>
          <button 
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
            onClick={onShow}
          >
            Show in Folder
          </button>
          <button 
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 border border-transparent hover:border-[var(--error)]/20 transition-all cursor-pointer active:scale-95" 
            onClick={() => onRemove(id)}
          >
            Delete
          </button>
        </>
      )}
      
      {status === 'downloading' && (
        <button 
          className="px-3 py-1.5 min-w-[64px] rounded-xl text-xs font-medium bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
          onClick={() => onPause(id)}
        >
          Pause
        </button>
      )}
      {status === 'paused' && (
        <button 
          className="px-3 py-1.5 min-w-[64px] rounded-xl text-xs font-medium bg-[var(--accent)] hover:opacity-90 text-[var(--accent-text)] transition-all cursor-pointer active:scale-95 shadow-xs" 
          onClick={() => onResume(id)}
        >
          Resume
        </button>
      )}
      {(status === 'downloading' || status === 'paused' || status === 'queued') && (
        <button 
          className="px-3 py-1.5 min-w-[64px] rounded-xl text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 border border-transparent hover:border-[var(--error)]/20 transition-all cursor-pointer active:scale-95" 
          onClick={() => onCancel(id)}
        >
          Cancel
        </button>
      )}
      {(status === 'cancelled' || status === 'error') && (
        <button 
          className="px-3 py-1.5 min-w-[64px] rounded-xl text-xs font-medium bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95" 
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
    <div className="glass flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-[var(--border-hairline)] shadow-xs hover:border-[var(--border-subtle)] transition-all duration-200">
      {/* Thumbnail with overlay badges */}
      <div className="relative w-28 h-16 rounded-xl overflow-hidden shrink-0 bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
        <img
          src={download.thumbnail}
          alt={download.title}
          className="w-full h-full object-cover"
        />
        {formatTag && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-black/70 text-white backdrop-blur-sm shadow-xs">
            {formatTag}
          </span>
        )}
        {isError && (
          <div className="absolute inset-0 bg-[var(--error)]/20 backdrop-blur-xs flex items-center justify-center text-[var(--error)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )}
      </div>

      {/* Middle content: Title, Badges, Progress, Stats */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {download.title}
          </div>
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

