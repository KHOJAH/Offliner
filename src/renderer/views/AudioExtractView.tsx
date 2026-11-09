// src/renderer/views/AudioExtractView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';
import VideoPreview from '@/renderer/components/VideoPreview';
import ClipToggle from '@/renderer/components/ClipToggle';
import ClipTimeline from '@/renderer/components/ClipTimeline';
import TimeInput from '@/renderer/components/TimeInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import type { VideoMetadata, ClipRange } from '@/types';

interface AudioCodecOption {
  id: string;
  name: string;
  engine: string;
  badge?: string;
  description: string;
}

const audioCodecs: AudioCodecOption[] = [
  { id: 'mp3', name: 'MP3', engine: 'MPEG-1 LAME 3.100', description: 'Universal CBR/VBR' },
  { id: 'flac', name: 'FLAC', engine: 'Lossless 24-bit', badge: 'Lossless', description: 'Free Lossless Audio' },
  { id: 'm4a', name: 'M4A', engine: 'ALAC / AAC', description: 'Apple Native CoreAudio' },
  { id: 'wav', name: 'WAV', engine: 'PCM Linear', description: 'Uncompressed Studio' },
  { id: 'opus', name: 'OPUS', engine: 'Direct Passthrough', description: 'Copy Lossless Stream' },
  { id: 'aac', name: 'AAC', engine: 'FDK-AAC', description: 'Broad compatibility' },
];

export default function AudioExtractView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [quality, setQuality] = useState(0); // 0 = best, 9 = worst
  const [embedArt, setEmbedArt] = useState(true);
  const [id3Tags, setId3Tags] = useState(true);
  const [normalizeLufs, setNormalizeLufs] = useState(false);
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(60);

  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const downloadPath = useSettingsStore((s) => s.downloadPath);

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
      } catch {
        addToast({ type: 'error', title: 'Error', message: 'Could not fetch video info.' });
      } finally {
        setLoading(false);
      }
    },
    [addToast, navigate]
  );

  useEffect(() => {
    if (location.pathname === '/audio' && location.state?.url && location.state?.autoAnalyze) {
      handleURL(location.state.url);
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  const handleDownload = async () => {
    if (!metadata) return;

    const clips: ClipRange[] | undefined = isClipping
      ? [{ name: 'clip', start: clipStart, end: clipEnd }]
      : undefined;

    const id = await ipcClient.addDownload({
      url: metadata.url,
      audioFormat: audioFormat,
      audioQuality: quality,
      outputPath: downloadPath,
      clips,
    });

    addDownload({
      id,
      url: metadata.url,
      title: `${metadata.title} (Audio)`,
      thumbnail: metadata.thumbnail,
      status: 'downloading',
      progress: 0,
      config: { url: metadata.url, audioFormat, audioQuality: quality, clips, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Audio extraction started', message: metadata.title });
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-8">
        {/* Header Context & Quick Metric */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wider">
                Module 03 // Precision Demuxer
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim" />
              <span className="text-[11px] text-primary font-medium">DSP Core v4.9 Active</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Audio Studio & Lossless Extraction
            </h1>
          </div>
          <div className="flex items-center gap-3 bg-surface border border-outline-variant/30 px-3.5 py-2 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">graphic_eq</span>
              <span className="text-xs font-mono text-text-secondary">Engine: FFmpeg (libopus/flac)</span>
            </div>
            <span className="w-1 h-3 bg-outline-variant/30" />
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-status-success" aria-hidden="true">
                speed
              </span>
              <span className="text-xs font-medium text-text-primary">Zero-Reencode Ready</span>
            </div>
          </div>
        </div>

        {/* Top URL Input Strip */}
        <div className="bg-surface border border-outline-variant/30 rounded-xl p-3 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-[18px]">link</span>
            </div>
            <div className="flex-1 min-w-0">
              <URLInput
                onURL={handleURL}
                loading={loading}
                initialValue={metadata?.url || (location.pathname === '/audio' ? location.state?.url : undefined)}
              />
            </div>
          </div>
        </div>

        {metadata && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stream Detected Banner */}
            <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-primary">sensors</span>
                <div>
                  <div className="text-xs font-semibold text-text-primary">Stream Detected: Opus 160kbps · 48,000 Hz · 2 Channels (Stereo)</div>
                  <div className="text-[11px] text-text-secondary">Direct Muxing Supported • Target Container: WebM (Audio/DASH)</div>
                </div>
              </div>
              <span className="text-[11px] font-mono bg-status-success/10 text-status-success font-semibold px-2.5 py-1 rounded-full">
                Bit-Perfect Pass
              </span>
            </div>

            {/* Main Stage Grid: Media Card + Transcode Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (5 cols): Media Preview & Stream Specs */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-xs space-y-4">
                  <VideoPreview metadata={metadata} />

                  <div className="grid grid-cols-2 gap-2 text-center pt-2">
                    <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/15">
                      <span className="text-[10px] uppercase font-semibold text-text-secondary block">
                        Raw Bitstream
                      </span>
                      <span className="text-xs font-mono font-medium text-text-primary">87.4 MB (Lossless)</span>
                    </div>
                    <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/15">
                      <span className="text-[10px] uppercase font-semibold text-text-secondary block">
                        LRA / Loudness
                      </span>
                      <span className="text-xs font-mono font-medium text-text-primary">18.2 LU</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (7 cols): Format Matrix & DSP Configuration */}
              <div className="lg:col-span-7 space-y-5">
                {/* Codec Selection Matrix */}
                <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-text-primary">Audio Format & Codec</h3>
                    <span className="text-[11px] font-mono text-text-secondary">Multi-Target DSP</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {audioCodecs.map((c) => {
                      const isSelected = audioFormat.toLowerCase() === c.id.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setAudioFormat(c.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 text-primary shadow-xs'
                              : 'border-outline-variant/30 bg-surface hover:bg-surface-container-low text-text-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm tracking-tight">{c.name.toUpperCase()}</span>
                            {c.badge && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-primary text-on-primary font-medium">
                                {c.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-secondary truncate">{c.engine}</div>
                          <div className="text-[10px] text-text-tertiary truncate">{c.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quality & Bitrate Slider */}
                <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-text-primary">Encoding Quality & Bitrate</h4>
                      <p className="text-[11px] text-text-secondary">Stepped variable bitrate target profile</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-primary">
                      {quality === 0 ? 'Studio Master (320 kbps)' : `VBR Level ${quality} (~${320 - quality * 20}k)`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="9"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-secondary font-mono">
                    <span>Best (0 / 320k)</span>
                    <span>High (256k)</span>
                    <span>Medium (192k)</span>
                    <span>Smallest (9 / 128k)</span>
                  </div>
                </div>

                {/* Metadata & Processing Pipeline */}
                <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-3">
                  <h4 className="font-semibold text-sm text-text-primary">Metadata & Processing Pipeline</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEmbedArt(!embedArt)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        embedArt ? 'border-primary/50 bg-primary/5 text-primary' : 'border-outline-variant/30 text-text-secondary'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-text-primary">Embed Cover Art</div>
                        <div className="text-[10px] text-text-secondary">Inject HD JPEG</div>
                      </div>
                      <span className="material-symbols-outlined text-[18px]">
                        {embedArt ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setId3Tags(!id3Tags)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        id3Tags ? 'border-primary/50 bg-primary/5 text-primary' : 'border-outline-variant/30 text-text-secondary'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-text-primary">ID3v2.4 Tags</div>
                        <div className="text-[10px] text-text-secondary">Artist, track & year</div>
                      </div>
                      <span className="material-symbols-outlined text-[18px]">
                        {id3Tags ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNormalizeLufs(!normalizeLufs)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        normalizeLufs ? 'border-primary/50 bg-primary/5 text-primary' : 'border-outline-variant/30 text-text-secondary'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-text-primary">Normalize LUFS</div>
                        <div className="text-[10px] text-text-secondary">Target -14 LUFS</div>
                      </div>
                      <span className="material-symbols-outlined text-[18px]">
                        {normalizeLufs ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Optional Trimming Accordion */}
                <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-3">
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
                        <TimeInput label="Start Time" value={clipStart} maxDuration={clipEnd} onChange={setClipStart} />
                        <TimeInput label="End Time" value={clipEnd} maxDuration={metadata.duration} onChange={setClipEnd} />
                      </div>
                    </div>
                  </ClipToggle>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-hover text-on-primary font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-[0.99] transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">music_note</span>
                  <span>Extract Audio ({audioFormat.toUpperCase()})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
