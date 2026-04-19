// src/renderer/views/VideoDownloadView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/components/URLInput';
import VideoPreview from '@/components/VideoPreview';
import FormatSelector from '@/components/FormatSelector';
import ClipToggle from '@/components/ClipToggle';
import ClipTimeline from '@/components/ClipTimeline';
import TimeInput from '@/components/TimeInput';
import { ipcClient } from '@/ipc/client';
import { useUIStore } from '@/stores/uiStore';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  const downloadPath = useSettingsStore((s) => s.downloadPath);

  const findBestVideoFormat = (formats: any[]) => {
    const videoFormats = formats.filter((f) => f.vcodec !== 'none');
    if (videoFormats.length === 0) return '';
    return [...videoFormats].sort((a, b) => {
      const resA = parseInt(a.resolution.split('x')[1] || '0') || 0;
      const resB = parseInt(b.resolution.split('x')[1] || '0') || 0;
      if (resB !== resA) return resB - resA;
      return (b.fps || 0) - (a.fps || 0);
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
      // Clear state so it doesn't re-fire
      navigate(location.pathname, { replace: true, state: { ...location.state, autoAnalyze: false } });
    }
  }, [location.pathname, location.state?.url, location.state?.autoAnalyze, handleURL, navigate]);

  const handleDownload = async () => {
    if (!metadata || !selectedFormat) return;

    const clips: ClipRange[] | undefined = isClipping ? [{ name: 'clip', start: clipStart, end: clipEnd }] : undefined;

    const id = await ipcClient.addDownload({
      url: metadata.url,
      format: selectedFormat,
      outputPath: downloadPath,
      clips,
    });

    addDownload({
      id,
      url: metadata.url,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      status: 'downloading',
      progress: 0,
      config: { url: metadata.url, format: selectedFormat, clips, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Download started', message: metadata.title });
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Download Video</h2>
        <URLInput 
          onURL={handleURL} 
          loading={loading} 
          initialValue={location.pathname === '/video' ? location.state?.url : undefined} 
        />

        {metadata && (
          <div className="page-enter" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <VideoPreview metadata={metadata} />
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ marginBottom: 16, fontSize: 16 }}>Format & Quality</h4>
              <FormatSelector
                formats={metadata.formats}
                selected={selectedFormat}
                onSelect={setSelectedFormat}
                mode="video"
              />
              
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
                disabled={!selectedFormat}
              >
                Download Video
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
