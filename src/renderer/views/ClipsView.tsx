// src/renderer/views/ClipsView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';
import VideoPreview from '@/renderer/components/VideoPreview';
import FormatSelector from '@/renderer/components/FormatSelector';
import ClipTimeline from '@/renderer/components/ClipTimeline';
import TimeInput from '@/renderer/components/TimeInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import type { VideoMetadata, ClipRange } from '@/types';

interface ClipDef {
  id: string;
  name: string;
  start: number;
  end: number;
}

export default function ClipsView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [clips, setClips] = useState<ClipDef[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(60);

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const downloadPath = useSettingsStore((s) => s.downloadPath);

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
      setEnd(meta.duration);
      const best = findBestVideoFormat(meta.formats);
      if (best) setSelectedFormat(best);
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Could not fetch video info.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, navigate]);

  useEffect(() => {
    if (location.pathname === '/clips' && location.state?.url && location.state?.autoAnalyze) {
      handleURL(location.state.url);
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  useEffect(() => {
    if (metadata) {
      setEnd(metadata.duration);
      const best = findBestVideoFormat(metadata.formats);
      if (best) setSelectedFormat(best);
    }
  }, [metadata]);

  const addClip = () => {
    if (!metadata) return;
    if (end <= start) {
      addToast({ type: 'error', title: 'Invalid clip duration', message: 'Clip end time must be greater than start time.' });
      return;
    }
    if (end - start < 1) {
      addToast({ type: 'error', title: 'Clip too short', message: 'Minimum clip duration is 1 second.' });
      return;
    }
    const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setClips((prev) => [...prev, {
      id,
      name: `Clip ${prev.length + 1}`,
      start,
      end,
    }]);
    addToast({ type: 'success', title: 'Clip added', message: `${Math.floor(end - start)}s` });
  };

  const removeClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  const nudgeStart = (delta: number) => {
    setStart((prev) => Math.max(0, Math.min(prev + delta, end - 1)));
  };

  const nudgeEnd = (delta: number) => {
    const maxDur = metadata?.duration || 3600;
    setEnd((prev) => Math.max(start + 1, Math.min(prev + delta, maxDur)));
  };

  const downloadAllClips = async () => {
    if (!metadata || clips.length === 0) return;

    const clipRanges: ClipRange[] = clips.map((c) => ({
      name: c.name,
      start: c.start,
      end: c.end,
    }));

    const formatToUse = selectedFormat || findBestVideoFormat(metadata.formats) || undefined;

    const id = await ipcClient.addDownload({
      url: metadata.url,
      format: formatToUse,
      outputPath: downloadPath,
      clips: clipRanges,
    });

    addDownload({
      id,
      url: metadata.url,
      title: `${metadata.title} (${clips.length} clips)`,
      thumbnail: metadata.thumbnail,
      status: 'downloading',
      progress: 0,
      config: { url: metadata.url, format: formatToUse, clips: clipRanges, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Clips download started', message: `${clips.length} clips` });
    setClips([]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Top Search & Ingestion */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] shadow-xs mb-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            Module 04 // Keyframe-Accurate Trimmer
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
          Precision Clips Trimmer
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-6">
          Non-destructive timeline extraction with frame-accurate soft-seek and multi-clip staging queue.
        </p>

        <URLInput
          onURL={handleURL}
          loading={loading}
          initialValue={location.pathname === '/clips' ? location.state?.url : undefined}
        />
      </div>

      {metadata && (
        <div className="animate-spring-in flex flex-col gap-6">
          {/* Stage Metadata Bar */}
          <div className="glass p-5 rounded-2xl border border-[var(--border-hairline)] shadow-sm flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] shrink-0">
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-black/75 text-white backdrop-blur-xs">
                STUDIO MASTER
              </div>
              <div className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-black/75 text-white backdrop-blur-xs">
                {formatTime(metadata.duration)}
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug mb-1 truncate">
                {metadata.title}
              </h3>
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] justify-center sm:justify-start">
                <span>{metadata.uploader}</span>
                <span>•</span>
                <span className="font-mono text-[var(--accent)]">24.00 fps Snapping</span>
                <span>•</span>
                <span>Stereo 48kHz</span>
              </div>
            </div>
          </div>

          {/* Format & Quality Selector Card */}
          <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)]">
                Format & Quality
              </h4>
              <span className="text-xs font-mono text-[var(--accent)] font-semibold">
                High-Bitrate Preservation
              </span>
            </div>
            <FormatSelector
              formats={metadata.formats}
              selected={selectedFormat}
              onSelect={setSelectedFormat}
              mode="video"
            />
          </div>

          {/* Precision Trimming Console */}
          <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-[var(--text-primary)]">
                New Clip
              </h4>
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
                <span>Range:</span>
                <span className="text-[var(--accent)] font-bold">{formatTime(start)} → {formatTime(end)}</span>
                <span className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] font-semibold">
                  {formatTime(end - start)}
                </span>
              </div>
            </div>

            {/* Scrubber Timeline */}
            <ClipTimeline
              duration={metadata.duration}
              start={start}
              end={end}
              onStartChange={setStart}
              onEndChange={setEnd}
            />

            {/* Timecode Inputs with Sub-second Micro-Nudges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-end">
              {/* Start Time with Nudges */}
              <div className="flex flex-col gap-2">
                <TimeInput label="Start" value={start} onChange={setStart} maxDuration={metadata.duration} />
                <div className="flex items-center gap-1.5 justify-start">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase mr-1">Nudge:</span>
                  <button
                    type="button"
                    onClick={() => nudgeStart(-1)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeStart(1)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* End Time with Nudges & Add Clip Button */}
              <div className="flex flex-col gap-2">
                <TimeInput label="End" value={end} onChange={setEnd} maxDuration={metadata.duration} />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase mr-1">Nudge:</span>
                    <button
                      type="button"
                      onClick={() => nudgeEnd(-1)}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeEnd(1)}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                    >
                      +1s
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={addClip}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-105 active:scale-95 transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    Add Clip
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Staged Clips Queue */}
          {clips.length > 0 && (
            <div className="glass p-6 rounded-2xl border border-[var(--border-hairline)] shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-[var(--text-primary)]">
                  Clips Queue ({clips.length})
                </h4>
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  Batch multi-segment export
                </span>
              </div>

              <div className="space-y-2.5">
                {clips.map((clip, idx) => (
                  <div
                    key={clip.id}
                    className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-[var(--accent)]">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {clip.name}
                        </div>
                        <div className="text-xs font-mono text-[var(--text-secondary)]">
                          {formatTime(clip.start)} → {formatTime(clip.end)}
                          <span className="ml-2 font-semibold text-[var(--accent)]">
                            ({(clip.end - clip.start).toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeClip(clip.id)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--error)]/10 hover:bg-[var(--error)]/20 text-[var(--error)] border border-[var(--error)]/20 transition-all cursor-pointer active:scale-95"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={downloadAllClips}
                  className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242l2.879-2.879m0 0a3 3 0 114.242-4.242L12 7.758" />
                  </svg>
                  <span>Download All Clips</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

