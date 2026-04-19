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

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginTop: 6, 
      fontSize: 11, 
      color: 'var(--text-secondary)',
      fontWeight: 500
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress.toFixed(1)}%</span>
        {isActive && (
          <>
            <span>{speed || '0 KB/s'}</span>
            <span>{eta ? `ETA ${eta}` : ''}</span>
          </>
        )}
        {!isCompleted && totalBytes && (
           <span>{formatSize(downloadedBytes)} / {formatSize(totalBytes)}</span>
        )}
        {isCompleted && totalBytes && (
           <span>{formatSize(totalBytes)}</span>
        )}
      </div>
      
      <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>
        {status}
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
    <div style={{ display: 'flex', gap: 8 }}>
      {isCompleted && (
        <>
          <button className="btn" onClick={onOpen} style={{ padding: '6px 12px' }}>Open</button>
          <button className="btn" onClick={onShow} style={{ padding: '6px 12px' }}>Show Folder</button>
          <button className="btn btn-danger" onClick={() => onRemove(id)} style={{ padding: '6px 12px' }}>Delete</button>
        </>
      )}
      
      {status === 'downloading' && (
        <button className="btn" onClick={() => onPause(id)} style={{ minWidth: 80, height: 32 }}>Pause</button>
      )}
      {status === 'paused' && (
        <button className="btn btn-primary" onClick={() => onResume(id)} style={{ minWidth: 80, height: 32 }}>Resume</button>
      )}
      {(status === 'downloading' || status === 'paused' || status === 'queued') && (
        <button className="btn btn-danger" onClick={() => onCancel(id)} style={{ minWidth: 80, height: 32 }}>Cancel</button>
      )}
      {(status === 'cancelled' || status === 'error') && (
        <button className="btn" onClick={() => onRemove(id)} style={{ minWidth: 80, height: 32 }}>Remove</button>
      )}
    </div>
  );
});

const DownloadCard = memo(({ download }: DownloadCardProps) => {
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);
  const removePermanent = useDownloadStore((s) => s.removePermanent);

  // Stats Display State (Updated every 3s)
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

  // 3s UI Update Interval
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

  return (
    <div className="glass" style={{ 
      padding: '16px 20px', 
      display: 'flex', 
      gap: 16, 
      alignItems: 'center',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ position: 'relative', width: 100, height: 56, flexShrink: 0 }}>
        <img
          src={download.thumbnail}
          alt={download.title}
          style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
        />
        {isError && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'rgba(255, 59, 48, 0.4)', 
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px'
          }}>!</div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          marginBottom: 6, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          color: 'var(--text-primary)'
        }}>
          {download.title}
        </div>
        
        {/* Progress bar stays smooth with current progress */}
        <ProgressBar download={download} />
        
        {/* Stats Row only updates every 3s */}
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
