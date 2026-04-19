// src/renderer/views/AudioExtractView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import URLInput from '@/components/URLInput';
import VideoPreview from '@/components/VideoPreview';
import ClipToggle from '@/components/ClipToggle';
import ClipTimeline from '@/components/ClipTimeline';
import TimeInput from '@/components/TimeInput';
import { ipcClient } from '@/ipc/client';
import { useUIStore } from '@/stores/uiStore';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { VideoMetadata, ClipRange } from '@/types';

const audioFormats = ['mp3', 'wav', 'flac', 'ogg', 'aac'] as const;

export default function AudioExtractView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [quality, setQuality] = useState(0); // 0 = best, 9 = worst
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(60);
  const addToast = useUIStore((s) => s.addToast);
  const addDownload = useDownloadStore((s) => s.addDownload);
  const downloadPath = useSettingsStore((s) => s.downloadPath);

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
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Could not fetch video info.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, navigate]);

  useEffect(() => {
    if (location.pathname === '/audio' && location.state?.url && location.state?.autoAnalyze) {
      handleURL(location.state.url);
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  const handleDownload = async () => {
    if (!metadata) return;

    const clips: ClipRange[] | undefined = isClipping ? [{ name: 'clip', start: clipStart, end: clipEnd }] : undefined;

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
    <div className="page-container">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Extract Audio</h2>
        <URLInput 
          onURL={handleURL} 
          loading={loading} 
          initialValue={location.pathname === '/audio' ? location.state?.url : undefined} 
        />

        {metadata && (
          <div className="page-enter" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <VideoPreview metadata={metadata} />
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h4 style={{ marginBottom: 12, fontSize: 16 }}>Format</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {audioFormats.map((fmt) => (
                      <button
                        key={fmt}
                        className={audioFormat === fmt ? 'btn btn-primary' : 'btn'}
                        onClick={() => setAudioFormat(fmt)}
                        style={{ minWidth: 80 }}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: 8, fontSize: 16 }}>Quality: {quality === 0 ? 'Best' : quality === 9 ? 'Smallest' : `${quality}`}</h4>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    <span>Best (0)</span>
                    <span>Smallest (9)</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, borderTop: '1px solid var(--glass-border)', paddingTop: 24 }}>
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
                  <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                    <TimeInput label="Start" value={clipStart} onChange={setClipStart} maxDuration={metadata.duration} />
                    <TimeInput label="End" value={clipEnd} onChange={setClipEnd} maxDuration={metadata.duration} />
                  </div>
                </ClipToggle>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleDownload}
                style={{ padding: '14px 48px', fontSize: 16, borderRadius: 'var(--radius-xl)' }}
              >
                Extract Audio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
