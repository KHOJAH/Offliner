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

  const handleURL = useCallback(
    async (url: string) => {
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
    },
    [addToast, navigate]
  );

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

    const newClip: ClipDef = {
      id: Math.random().toString(36).substring(7),
      name: `Clip ${clips.length + 1}`,
      start,
      end,
    };
    setClips([...clips, newClip]);
    addToast({ type: 'success', title: 'Clip added', message: `${newClip.name} (${(end - start).toFixed(1)}s)` });
  };

  const removeClip = (id: string) => {
    setClips(clips.filter((c) => c.id !== id));
  };

  const handleDownloadAll = async () => {
    if (!metadata) return;
    if (clips.length === 0) {
      addToast({ type: 'warning', title: 'No clips staged', message: 'Add at least one clip segment before downloading.' });
      return;
    }

    const formatToUse = selectedFormat || findBestVideoFormat(metadata.formats) || undefined;
    const clipRanges: ClipRange[] = clips.map((c) => ({
      name: c.name,
      start: c.start,
      end: c.end,
    }));

    const id = await ipcClient.addDownload({
      url: metadata.url,
      format: formatToUse,
      outputPath: downloadPath,
      clips: clipRanges,
    });

    addDownload({
      id,
      url: metadata.url,
      title: `${metadata.title} (${clips.length} Clips)`,
      thumbnail: metadata.thumbnail,
      status: 'downloading',
      progress: 0,
      config: { url: metadata.url, format: formatToUse, clips: clipRanges, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Batch clip download started', message: `${clips.length} segments queued` });
  };

  return (
    <div className="flex flex-col w-full">
      <div className="w-full max-w-6xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Clips
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Cut and export video segments with frame precision.
          </p>
        </div>

        {/* URL Input Strip */}
        <div className="w-full max-w-3xl mx-auto">
          <URLInput
            onURL={handleURL}
            loading={loading}
            initialValue={metadata?.url || (location.pathname === '/clips' ? location.state?.url : undefined)}
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
                d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.877v.03a2.165 2.165 0 0 1-1.083 1.877l-1.536.887m0 0a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887 6.364-3.675m0 0a3 3 0 1 1 5.196 3 3 3 0 0 1-5.196-3Zm-6.364 3.675 6.364 3.675m0 0a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Z"
              />
            </svg>
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">
              Ready to create clips
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] max-w-sm text-center mt-1">
              Paste a video link above to select and extract clip segments.
            </p>
          </div>
        )}

        {metadata && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Media Metadata Banner */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5 min-w-0 flex-1">
                <div className="relative shrink-0 w-36 h-22 rounded-lg overflow-hidden bg-surface-container shadow-xs">
                  <img src={metadata.thumbnail} alt={metadata.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px]">
                    {Math.floor(metadata.duration / 60)}:{String(Math.floor(metadata.duration % 60)).padStart(2, '0')}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-text-primary truncate">{metadata.title}</h3>
                  <p className="text-xs text-text-secondary mt-0.5">{metadata.uploader}</p>
                </div>
              </div>
            </div>

            {/* Precision Timeline Stage */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">timer</span>
                  <span className="text-xs font-mono text-text-secondary">
                    Selection: <strong className="text-text-primary">{(start).toFixed(1)}s</strong> – <strong className="text-text-primary">{(end).toFixed(1)}s</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                  <span>Duration: <strong className="text-primary">{(end - start).toFixed(1)}s</strong></span>
                </div>
              </div>

              {/* Scrubber Component */}
              <ClipTimeline
                duration={metadata.duration}
                start={start}
                end={end}
                onStartChange={setStart}
                onEndChange={setEnd}
              />

              {/* Numerical Inputs with Micro-Nudge Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-text-secondary tracking-wider">
                    <span>Start</span>
                    <span className="text-[11px] font-mono text-primary">{(start).toFixed(1)}s</span>
                  </div>
                  <TimeInput label="Start (Seconds)" value={start} maxDuration={end} onChange={setStart} />
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setStart(Math.max(0, start - 1))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => setStart(Math.min(end - 1, start + 1))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      onClick={() => setStart(Math.max(0, start - 0.04))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      -1f
                    </button>
                    <button
                      type="button"
                      onClick={() => setStart(Math.min(end - 0.04, start + 0.04))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      +1f
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-text-secondary tracking-wider">
                    <span>End</span>
                    <span className="text-[11px] font-mono text-primary">{(end).toFixed(1)}s</span>
                  </div>
                  <TimeInput label="End (Seconds)" value={end} maxDuration={metadata.duration} onChange={setEnd} />
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEnd(Math.max(start + 1, end - 1))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnd(Math.min(metadata.duration, end + 1))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnd(Math.max(start + 0.04, end - 0.04))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      -1f
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnd(Math.min(metadata.duration, end + 0.04))}
                      className="px-2 py-1 rounded bg-surface border border-outline-variant/20 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                    >
                      +1f
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Add Clip */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={addClip}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_circle</span>
                  <span>Add Clip</span>
                </button>
              </div>
            </div>

            {/* Quality & Format Card */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-text-primary">Format & Quality</h3>
                <span className="text-[11px] font-mono text-text-secondary">Applies to all staged clips</span>
              </div>
              <FormatSelector
                formats={metadata.formats}
                selected={selectedFormat}
                onSelect={setSelectedFormat}
              />
            </div>

            {/* Extraction Queue / Selected Clips */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-text-primary">Selected Clips</h4>
                  <p className="text-xs text-text-secondary">
                    Clips ready for download.
                  </p>
                </div>
                <span className="text-xs font-mono bg-surface-container px-3 py-1 rounded-full text-text-primary font-medium">
                  {clips.length} {clips.length === 1 ? 'Clip' : 'Clips'}
                </span>
              </div>

              {clips.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-secondary border border-dashed border-outline-variant/30 rounded-xl">
                  No clips added yet. Set your start and end times above and click Add Clip.
                </div>
              ) : (
                <div className="space-y-2">
                  {clips.map((clip, idx) => (
                    <div
                      key={clip.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/15 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-surface font-mono font-bold flex items-center justify-center text-primary text-[11px] border border-outline-variant/20">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <div className="font-semibold text-text-primary">{clip.name}</div>
                          <div className="text-[11px] font-mono text-text-secondary">
                            {clip.start.toFixed(2)}s → {clip.end.toFixed(2)}s • Duration: {(clip.end - clip.start).toFixed(1)}s
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeClip(clip.id)}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-status-error hover:bg-surface transition-colors"
                        title="Remove Segment"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Master CTA Download All */}
              <div className="pt-4 border-t border-outline-variant/15 flex justify-end">
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={clips.length === 0}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
                  <span>Download All Clips</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
