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
  const [containerFormat, setContainerFormat] = useState<'mp4' | 'mkv'>('mp4');
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(metadata?.duration || 60);

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const downloadPath = useSettingsStore((s) => s.downloadPath);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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
        setClipEnd(meta.duration);
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
      await updateSettings({ downloadPath: path });
      addToast({ type: 'success', title: 'Target directory updated', message: path });
    }
  };

  const handleDownload = async () => {
    if (!metadata) return;

    if (isClipping) {
      if (clipEnd <= clipStart) {
        addToast({
          type: 'error',
          title: 'Invalid clip duration',
          message: 'Clip end time must be greater than start time.',
        });
        return;
      }
      if (clipEnd - clipStart < 1) {
        addToast({
          type: 'error',
          title: 'Clip too short',
          message: 'Minimum clip duration is 1 second.',
        });
        return;
      }
    }

    const formatToUse = selectedFormat || findBestVideoFormat(metadata.formats) || undefined;
    const clips: ClipRange[] | undefined = isClipping
      ? [{ name: 'clip', start: clipStart, end: clipEnd }]
      : undefined;

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
    <div className="flex flex-col w-full">
      <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Top URL / Stream Ingestion Strip */}
        <div className="bg-surface border border-outline-variant/30 rounded-xl p-3 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-[18px]">link</span>
            </div>
            <div className="flex-1 min-w-0">
              <URLInput
                onURL={handleURL}
                loading={loading}
                initialValue={metadata?.url || (location.pathname === '/video' ? location.state?.url : undefined)}
              />
            </div>
          </div>
          {metadata && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleURL(metadata.url)}
                className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-xs font-medium"
                title="Re-analyze Stream"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Re-analyze</span>
              </button>
            </div>
          )}
        </div>

        {metadata && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            {/* Left Column (5 cols): Metadata, Thumbnail & Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-xs space-y-4">
                <VideoPreview metadata={metadata} />
              </div>

              {/* Target Destination Directory Card */}
              <div className="bg-surface border border-outline-variant/30 rounded-xl p-3.5 shadow-xs flex items-center justify-between text-text-secondary">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-primary">folder_open</span>
                  <div className="truncate">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">
                      Target Directory
                    </p>
                    <p className="text-xs font-mono text-text-primary truncate" title={downloadPath}>
                      {downloadPath || '~/Movies/Offliner/'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSelectPath}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-medium text-text-primary shrink-0"
                  type="button"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Right Column (7 cols): Transcode & Quality Configuration Panel */}
            <div className="lg:col-span-7 space-y-5">
              {/* Format & Quality Section */}
              <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                  <h3 className="font-semibold text-sm text-text-primary">Format & Quality</h3>
                </div>

                <FormatSelector
                  formats={metadata.formats}
                  selected={selectedFormat}
                  onSelect={setSelectedFormat}
                />

                {/* Container & Codec Selector */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                    Container
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setContainerFormat('mp4')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        containerFormat === 'mp4'
                          ? 'border-primary bg-primary/5 text-primary font-semibold shadow-xs'
                          : 'border-outline-variant/30 bg-surface hover:bg-surface-container-low text-text-primary'
                      }`}
                    >
                      <div className="font-medium">MP4</div>
                      <div className="text-[10px] text-text-secondary font-normal">Standard compatibility</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContainerFormat('mkv')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        containerFormat === 'mkv'
                          ? 'border-primary bg-primary/5 text-primary font-semibold shadow-xs'
                          : 'border-outline-variant/30 bg-surface hover:bg-surface-container-low text-text-primary'
                      }`}
                    >
                      <div className="font-medium">MKV</div>
                      <div className="text-[10px] text-text-secondary font-normal">High quality & subtitles</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Precision Trimmer Accordion */}
              <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-4">
                <ClipToggle
                  duration={metadata.duration}
                  expanded={isClipping}
                  onToggle={setIsClipping}
                >
                  <div className="space-y-4 pt-2 border-t border-outline-variant/20">
                    <ClipTimeline
                      duration={metadata.duration}
                      start={clipStart}
                      end={clipEnd}
                      onStartChange={setClipStart}
                      onEndChange={setClipEnd}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <TimeInput
                        label="In-Point (Start)"
                        value={clipStart}
                        maxDuration={clipEnd}
                        onChange={setClipStart}
                      />
                      <TimeInput
                        label="Out-Point (End)"
                        value={clipEnd}
                        maxDuration={metadata.duration}
                        onChange={setClipEnd}
                      />
                    </div>
                  </div>
                </ClipToggle>
              </div>

              {/* Master CTA Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-[0.99] transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">download</span>
                  <span>{isClipping ? 'Download Clip' : 'Download Video'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
