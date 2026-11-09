// src/renderer/views/VideoDownloadView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';
import VideoPreview from '@/renderer/components/VideoPreview';
import FormatSelector from '@/renderer/components/FormatSelector';
import ClipToggle from '@/renderer/components/ClipToggle';
import ClipTimeline from '@/renderer/components/ClipTimeline';
import TimeInput from '@/renderer/components/TimeInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import type { VideoMetadata, ClipRange } from '@/types';

export default function VideoDownloadView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(location.state?.metadata || null);
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(metadata?.duration || 60);

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const settings = useSettingsStore();
  const downloadPath = settings.downloadPath;

  const findBestVideoFormat = (formats: any[]) => {
    const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none');
    if (videoFormats.length === 0) return '';
    return [...videoFormats].sort((a, b) => {
      const getResNumber = (resStr?: string): number => {
        if (!resStr) return 0;
        if (resStr.includes('x')) {
          const parts = resStr.split('x');
          const w = parseInt(parts[0], 10) || 0;
          const h = parseInt(parts[1], 10) || 0;
          return Math.max(w, h);
        }
        return parseInt(resStr, 10) || 0;
      };
      const resA = getResNumber(a.resolution);
      const resB = getResNumber(b.resolution);
      if (resB !== resA) return resB - resA;
      if ((b.fps || 0) !== (a.fps || 0)) return (b.fps || 0) - (a.fps || 0);
      return (b.vbr || b.tbr || b.abr || 0) - (a.vbr || a.tbr || a.abr || 0);
    })[0]?.format_id;
  };

  const handleURL = useCallback(async (url: string) => {
    if (!url.trim()) return;

    if (url.includes('list=') || url.includes('playlist?')) {
      addToast({ type: 'info', title: 'Playlist Detected', message: 'Redirecting to Playlist tab...' });
      navigate('/playlist', { state: { url, autoAnalyze: true } });
      return;
    }

    setLoading(true);
    try {
      const meta = await ipcClient.getMetadata(url);
      setMetadata(meta);
      setClipEnd(meta.duration);
      const best = findBestVideoFormat(meta.formats);
      if (best) setSelectedFormat(best);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Could not fetch video info.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, navigate]);

  useEffect(() => {
    if (metadata) {
      setClipEnd(metadata.duration);
      const bestFormatId = findBestVideoFormat(metadata.formats);
      if (bestFormatId) {
        setSelectedFormat(bestFormatId);
      }
    }
  }, [metadata]);

  useEffect(() => {
    if (location.pathname === '/video' && location.state?.url && location.state?.autoAnalyze) {
      handleURL(location.state.url);
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  const handleSelectPath = async () => {
    const path = await ipcClient.selectDownloadPath();
    if (path) {
      await settings.updateSettings({ downloadPath: path });
      addToast({ type: 'success', title: 'Download path updated', message: path });
    }
  };

  const handleDownload = async () => {
    if (!metadata) return;

    if (isClipping) {
      if (clipEnd <= clipStart) {
        addToast({ type: 'error', title: 'Invalid clip duration', message: 'Clip end time must be greater than start time.' });
        return;
      }
      if (clipEnd - clipStart < 1) {
        addToast({ type: 'error', title: 'Clip too short', message: 'Minimum clip duration is 1 second.' });
        return;
      }
    }

    const formatToUse = selectedFormat || findBestVideoFormat(metadata.formats) || undefined;
    const clips: ClipRange[] | undefined = isClipping ? [{ name: 'clip', start: clipStart, end: clipEnd }] : undefined;

    const id = await ipcClient.addDownload({
      url: metadata.url,
      format: formatToUse,
      outputPath: downloadPath,
      clips,
    });

    addDownload({
      id,
      url: metadata.url,
      title: isClipping ? `${metadata.title} (Clip)` : metadata.title,
      thumbnail: metadata.thumbnail,
      status: 'downloading',
      progress: 0,
      config: { url: metadata.url, format: formatToUse, clips, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Download started', message: metadata.title });
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Page Header & Omnibox */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
          Download Video
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-6">
          High-definition stream ingestion with automated DASH video & audio multiplexing.
        </p>
        <URLInput
          onURL={handleURL}
          loading={loading}
          initialValue={location.pathname === '/video' ? location.state?.url : undefined}
        />
      </div>

      {metadata && (
        <div className="animate-spring-in grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 Cols): Media Inspection & Storage */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
              <VideoPreview metadata={metadata} />
            </div>

            {/* 3-Card Stream Specs Matrix */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="glass p-3 rounded-xl border border-[var(--border-hairline)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">Stream</div>
                <div className="text-xs font-bold text-[var(--text-primary)]">DASH AV1</div>
              </div>
              <div className="glass p-3 rounded-xl border border-[var(--border-hairline)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">Audio</div>
                <div className="text-xs font-bold text-[var(--text-primary)]">48 kHz</div>
              </div>
              <div className="glass p-3 rounded-xl border border-[var(--border-hairline)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">Container</div>
                <div className="text-xs font-bold text-[var(--accent)]">MP4</div>
              </div>
            </div>

            {/* Destination Directory Card */}
            <div className="glass p-4 rounded-2xl border border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[var(--text-secondary)]">Download Path</div>
                  <div className="text-xs font-mono text-[var(--text-primary)] truncate max-w-[200px]" title={downloadPath}>
                    {downloadPath || 'Default Storage'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSelectPath}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer shrink-0"
              >
                Change
              </button>
            </div>
          </div>

          {/* Right Column (7 Cols): Configuration, Quality Grid, Trimmer, Download */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-[var(--text-primary)]">
                  Format & Quality
                </h4>
                <span className="text-xs font-mono text-[var(--accent)] font-semibold">
                  Lossless Passthrough
                </span>
              </div>

              {/* FormatSelector */}
              <FormatSelector
                formats={metadata.formats}
                selected={selectedFormat}
                onSelect={setSelectedFormat}
                mode="video"
              />

              {/* Precision Trimmer Accordion */}
              <div className="mt-6 pt-6 border-t border-[var(--border-hairline)]">
                <ClipToggle
                  duration={metadata.duration}
                  expanded={isClipping}
                  onToggle={setIsClipping}
                >
                  <ClipTimeline
                    duration={metadata.duration}
                    start={clipStart}
                    end={clipEnd}
                    onStartChange={setClipStart}
                    onEndChange={setClipEnd}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <TimeInput label="Start" value={clipStart} onChange={setClipStart} maxDuration={metadata.duration} />
                    <TimeInput label="End" value={clipEnd} onChange={setClipEnd} maxDuration={metadata.duration} />
                  </div>
                </ClipToggle>
              </div>

              {/* Primary Download CTA */}
              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!metadata}
                  className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{isClipping ? 'Download Clip' : 'Download Video'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

