// src/renderer/views/PlaylistView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import type { VideoMetadata } from '@/types';

const videoPresets = [
  { id: '1080', label: '1080p Full HD', ext: 'mp4', sub: 'Standard Quality' },
  { id: '2160', label: '4K Ultra HD', ext: 'mkv', sub: 'Best Quality' },
  { id: '720', label: '720p HD', ext: 'mp4', sub: 'Fast Download' },
];

const audioPresets = [
  { id: 'mp3', label: 'MP3', sub: 'Universal Compatibility' },
  { id: 'flac', label: 'FLAC Lossless', sub: 'Original Quality' },
];

export default function PlaylistView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [videoQuality, setVideoQuality] = useState('1080');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'mkv'>('mp4');
  const [audioFormat, setAudioFormat] = useState('mp3');

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const settings = useSettingsStore();
  const downloadPath = settings.downloadPath;

  const handleURL = useCallback(
    async (url: string) => {
      if (!url.trim()) return;

      const isPlaylist = url.includes('list=') || url.includes('playlist?');
      if (!isPlaylist) {
        addToast({ type: 'info', title: 'Video Detected', message: 'Redirecting to Video tab...' });
        navigate('/video', { state: { url, autoAnalyze: true } });
        return;
      }

      setLoading(true);
      try {
        const meta = await ipcClient.getMetadata(url);
        setMetadata(meta);
        if (meta.entries) {
          setSelectedItems(new Set(meta.entries.map((e) => e.id)));
        }
      } catch {
        addToast({ type: 'error', title: 'Error', message: 'Could not fetch playlist info.' });
      } finally {
        setLoading(false);
      }
    },
    [addToast, navigate]
  );

  useEffect(() => {
    if (location.pathname === '/playlist' && location.state?.url && location.state?.autoAnalyze) {
      handleURL(location.state.url);
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!metadata?.entries) return;
    if (selectedItems.size === metadata.entries.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(metadata.entries.map((e) => e.id)));
    }
  };

  const downloadSelected = async () => {
    if (!metadata || !metadata.entries) return;
    const toDownload = metadata.entries.filter((e) => selectedItems.has(e.id));
    if (toDownload.length === 0) {
      addToast({ type: 'warning', title: 'No videos selected', message: 'Please select at least one video to download.' });
      return;
    }

    for (const entry of toDownload) {
      const videoUrl = `https://youtube.com/watch?v=${entry.id}`;
      const config =
        mode === 'video'
          ? {
              url: videoUrl,
              format: `bestvideo[height<=${videoQuality}][ext=${videoFormat}]+bestaudio/best`,
              outputPath: downloadPath,
            }
          : {
              url: videoUrl,
              audioFormat: audioFormat,
              audioQuality: 0,
              outputPath: downloadPath,
            };

      const id = await ipcClient.addDownload(config);
      addDownload({
        id,
        url: videoUrl,
        title: entry.title,
        thumbnail: entry.thumbnail,
        status: 'queued',
        progress: 0,
        config,
        createdAt: Date.now(),
      });
    }

    addToast({
      type: 'success',
      title: 'Downloads Added',
      message: `Added ${toDownload.length} ${toDownload.length === 1 ? 'item' : 'items'} to your download queue.`,
    });
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col w-full">
      <div className="w-full max-w-6xl mx-auto px-6 lg:px-8 py-8 space-y-6">
        {/* Top URL Input Strip */}
        <div className="w-full max-w-3xl mx-auto">
          <URLInput
            onURL={handleURL}
            loading={loading}
            placeholder="Paste YouTube playlist URL here..."
            initialValue={metadata?.url || (location.pathname === '/playlist' ? location.state?.url : undefined)}
          />
        </div>

        {/* Empty State when !metadata */}
        {!metadata && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <svg
              className="w-10 h-10 text-[var(--text-tertiary)] mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
              />
            </svg>
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              No playlist loaded
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] max-w-sm text-center mt-1">
              Paste a YouTube playlist link above to preview and download all tracks.
            </p>
          </div>
        )}

        {metadata && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Playlist Overview Header Card */}
            <section className="bg-surface border border-outline-variant/30 rounded-2xl shadow-xs p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 z-10">
                <div className="w-24 h-24 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 overflow-hidden shadow-xs">
                  {metadata.thumbnail ? (
                    <img src={metadata.thumbnail} alt={metadata.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-4xl">queue_music</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      {metadata.uploader || 'Curated Collection'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                    {metadata.title}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {metadata.entries?.length || 0} videos
                  </p>
                </div>
              </div>

              {/* Destination Drive Metric */}
              <div className="bg-surface-container-low border border-outline-variant/15 p-4 rounded-xl flex items-center gap-4 z-10 shrink-0">
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">folder</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-text-secondary">Save to</div>
                  <div className="text-xs font-mono font-medium text-text-primary truncate max-w-[180px]">
                    {downloadPath || 'Default Storage'}
                  </div>
                </div>
              </div>
            </section>

            {/* Transcode Format Presets Bar */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('video')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'video'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">videocam</span>
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('audio')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'audio'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                  <span>Audio</span>
                </button>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {mode === 'video' ? (
                  <>
                    {videoPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setVideoQuality(p.id);
                          setVideoFormat(p.ext as any);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          videoQuality === p.id
                            ? 'border-primary bg-primary/5 text-primary font-semibold'
                            : 'border-outline-variant/30 bg-surface-container-low text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {audioPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAudioFormat(p.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          audioFormat === p.id
                            ? 'border-primary bg-primary/5 text-primary font-semibold'
                            : 'border-outline-variant/30 bg-surface-container-low text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Checklist & Selection Bar */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={metadata.entries ? selectedItems.size === metadata.entries.length : false}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    {selectedItems.size} of {metadata.entries?.length || 0} selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {metadata.entries && selectedItems.size === metadata.entries.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={downloadSelected}
                    disabled={selectedItems.size === 0}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                    <span>Download Selected ({selectedItems.size})</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="divide-y divide-outline-variant/15 max-h-[480px] overflow-y-auto">
                {metadata.entries?.map((entry, idx) => {
                  const isChecked = selectedItems.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleItem(entry.id)}
                      className={`p-3.5 flex items-center gap-4 transition-colors cursor-pointer ${
                        isChecked ? 'bg-primary/[0.02] hover:bg-primary/[0.04]' : 'hover:bg-surface-container-low/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(entry.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer accent-primary"
                      />
                      <span className="text-xs font-mono text-text-secondary w-6 text-right shrink-0">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="w-16 h-10 rounded bg-surface-container overflow-hidden shrink-0 relative">
                        {entry.thumbnail && (
                          <img src={entry.thumbnail} alt="" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono bg-black/80 text-white px-1 rounded">
                          {formatDuration(entry.duration)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-text-primary truncate">{entry.title}</div>
                        <div className="text-[11px] text-text-secondary truncate">{entry.uploader || metadata.uploader}</div>
                      </div>
                      <span className="text-xs font-mono text-text-secondary shrink-0 hidden sm:inline-block">
                        {mode === 'video' ? `${videoQuality}p` : audioFormat.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
