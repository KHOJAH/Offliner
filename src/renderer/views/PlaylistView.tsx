// src/renderer/views/PlaylistView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import type { VideoMetadata } from '@/types';

const qualities = [
  { label: '4K (2160p)', value: '2160' },
  { label: '2K (1440p)', value: '1440' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
];

export default function PlaylistView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'mkv'>('mp4');
  const [videoQuality, setVideoQuality] = useState('1080');
  const [audioFormat, setAudioFormat] = useState('flac');

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const settings = useSettingsStore();
  const downloadPath = settings.downloadPath;

  const handleURL = useCallback(async (url: string) => {
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
  }, [addToast, navigate]);

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

    for (const entry of toDownload) {
      const videoUrl = `https://youtube.com/watch?v=${entry.id}`;
      const config = mode === 'video'
        ? {
            url: videoUrl,
            format: `bestvideo[height<=${videoQuality}][ext=${videoFormat}]+bestaudio/best`,
            outputPath: downloadPath,
          }
        : {
            url: videoUrl,
            audioFormat: audioFormat,
            outputPath: downloadPath,
            extractAudio: true,
          };

      const id = await ipcClient.addDownload(config);

      addDownload({
        id,
        url: videoUrl,
        title: entry.title + (mode === 'audio' ? ' (Audio)' : ''),
        thumbnail: entry.thumbnail || metadata.thumbnail,
        status: 'downloading',
        progress: 0,
        config: { ...config, isPlaylist: true, outputPath: downloadPath },
        createdAt: Date.now(),
      });
    }

    addToast({ type: 'success', title: 'Playlist download started', message: `${toDownload.length} items queued` });
  };

  // Collage previews (up to 4 thumbnails)
  const collageThumbnails = metadata?.entries
    ? metadata.entries.slice(0, 4).map((e) => e.thumbnail || metadata.thumbnail)
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Top Search & Ingestion */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
          Playlist Batch Downloader
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-6">
          High-throughput batch media ingest with synchronized format profiles and concurrency pooling.
        </p>

        <URLInput
          onURL={handleURL}
          loading={loading}
          placeholder="Paste YouTube playlist URL here..."
          initialValue={location.pathname === '/playlist' ? location.state?.url : undefined}
        />
      </div>

      {metadata && (
        <div className="animate-spring-in flex flex-col gap-6">
          {/* Top Summary Banner: 2x2 Collage Artwork + Destination Drive Donut */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* 2x2 Collage Artwork Card */}
            <div className="md:col-span-8 glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-40 h-28 rounded-xl overflow-hidden bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] shrink-0 shadow-xs">
                {collageThumbnails.length >= 4 ? (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
                    {collageThumbnails.map((thumb, idx) => (
                      <img key={idx} src={thumb} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                ) : (
                  <img
                    src={metadata.thumbnail}
                    alt={metadata.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-0.5 text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10m4-4v6m3-3h-6" />
                    </svg>
                    <span className="text-[10px] font-mono font-bold">{metadata.entries?.length || 0} ITEMS</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--accent-subtle)] text-[var(--accent)] mb-1 uppercase tracking-wider">
                  Batch Inspection Verified
                </span>
                <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug mb-1 truncate">
                  {metadata.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] justify-center sm:justify-start">
                  <span>{metadata.uploader || 'YouTube Channel'}</span>
                  <span>•</span>
                  <span>{metadata.entries?.length || 0} media streams</span>
                  <span>•</span>
                  <span>Fast flat-playlist mode</span>
                </div>
              </div>
            </div>

            {/* Destination Drive Storage Card with Circular Donut */}
            <div className="md:col-span-4 glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                  Storage Allocation
                </div>
                <div className="text-xs font-mono font-semibold text-[var(--text-primary)] truncate" title={downloadPath}>
                  {downloadPath || 'Default Storage'}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Ready for ~{(selectedItems.size * 185 / 1024).toFixed(1)} GB
                </div>
              </div>

              {/* Circular storage donut gauge */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[var(--bg-surface-elevated)] stroke-current"
                    strokeWidth="3.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="stroke-current text-[var(--accent)]"
                    strokeDasharray="42, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono text-[10px] font-bold text-[var(--text-primary)]">
                  42%
                </span>
              </div>
            </div>
          </div>

          {/* Batch Configuration Controls Toolbar */}
          <div className="glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 flex-wrap">
                {/* Mode Segmented Toggle */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">MODE</span>
                  <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
                    <button
                      type="button"
                      onClick={() => setMode('video')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        mode === 'video'
                          ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('audio')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        mode === 'audio'
                          ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Audio
                    </button>
                  </div>
                </div>

                {mode === 'video' ? (
                  <>
                    {/* Container Format */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">FORMAT</span>
                      <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
                        <button
                          type="button"
                          onClick={() => setVideoFormat('mp4')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            videoFormat === 'mp4'
                              ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          MP4
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoFormat('mkv')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            videoFormat === 'mkv'
                              ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          MKV
                        </button>
                      </div>
                    </div>

                    {/* Resolution Quality Dropdown */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">QUALITY</span>
                      <select
                        value={videoQuality}
                        onChange={(e) => setVideoQuality(e.target.value)}
                        className="h-8 px-3 rounded-xl bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs font-medium outline-none focus:border-[var(--accent)] cursor-pointer"
                      >
                        {qualities.map((q) => (
                          <option key={q.value} value={q.value}>{q.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">AUDIO FORMAT</span>
                    <select
                      value={audioFormat}
                      onChange={(e) => setAudioFormat(e.target.value)}
                      className="h-8 px-3 rounded-xl bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs font-medium outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      <option value="flac">FLAC (Lossless)</option>
                      <option value="mp3">MP3 (320kbps)</option>
                      <option value="wav">WAV</option>
                      <option value="m4a">M4A</option>
                      <option value="opus">Opus</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Master Select & Download Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95"
                >
                  {selectedItems.size === (metadata.entries?.length || 0) ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={selectedItems.size === 0}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 select-none ${
                    selectedItems.size === 0
                      ? 'opacity-60 cursor-not-allowed bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-hairline)]'
                      : 'bg-[var(--accent)] hover:brightness-105 text-[var(--accent-text)] cursor-pointer'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Items</span>
                </button>
              </div>
            </div>

            {/* Selection Counter Status */}
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-3 border-t border-[var(--border-hairline)]">
              <div className="flex items-center gap-2 font-medium">
                <span className="text-[var(--accent)] font-semibold font-mono">{selectedItems.size} Selected</span>
                <span>•</span>
                <span>{metadata.entries?.length || 0} total items in playlist</span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                Unified batch format sync enabled
              </span>
            </div>
          </div>

          {/* Playlist Table Section */}
          <div className="glass rounded-2xl border border-[var(--border-hairline)] overflow-hidden shadow-sm">
            <div className="max-h-[460px] overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {metadata.entries?.map((entry, index) => {
                const isSelected = selectedItems.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    onClick={() => toggleItem(entry.id)}
                    className={`flex items-center gap-4 p-3.5 transition-colors cursor-pointer select-none ${
                      isSelected ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Numerical Index */}
                    <span className="font-mono text-xs font-semibold text-[var(--text-tertiary)] w-6 text-center shrink-0">
                      #{String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Thumbnail with duration */}
                    <div className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0 bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
                      <img
                        src={entry.thumbnail || metadata.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {entry.duration ? (
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-black/75 text-white backdrop-blur-xs">
                          {Math.floor(entry.duration / 60)}:{String(entry.duration % 60).padStart(2, '0')}
                        </span>
                      ) : null}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate mb-0.5">
                        {entry.title}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span>{entry.duration ? `${Math.floor(entry.duration / 60)}:${String(entry.duration % 60).padStart(2, '0')}` : 'Duration unknown'}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{entry.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

