// src/renderer/views/ClipsView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/components/URLInput';
import VideoPreview from '@/components/VideoPreview';
import ClipTimeline from '@/components/ClipTimeline';
import TimeInput from '@/components/TimeInput';
import { ipcClient } from '@/ipc/client';
import { useUIStore } from '@/stores/uiStore';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  const [clips, setClips] = useState<ClipDef[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(60);
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
      setEnd(meta.duration);
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
    }
  }, [metadata]);

  const addClip = () => {
    if (!metadata) return;
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

  const downloadAllClips = async () => {
    if (!metadata || clips.length === 0) return;

    const clipRanges: ClipRange[] = clips.map((c) => ({
      name: c.name,
      start: c.start,
      end: c.end,
    }));

    const id = await ipcClient.addDownload({
      url: metadata.url,
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
      config: { url: metadata.url, clips: clipRanges, outputPath: downloadPath },
      createdAt: Date.now(),
    });

    addToast({ type: 'success', title: 'Clips download started', message: `${clips.length} clips` });
    setClips([]);
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Create Clips</h2>
        <URLInput 
          onURL={handleURL} 
          loading={loading} 
          initialValue={location.pathname === '/clips' ? location.state?.url : undefined} 
        />

        {metadata && (
          <div className="page-enter" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <VideoPreview metadata={metadata} />
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ marginBottom: 16, fontSize: 16 }}>New Clip</h4>
              <ClipTimeline
                duration={metadata.duration}
                start={start}
                end={end}
                onStartChange={setStart}
                onEndChange={setEnd}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 24, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, display: 'flex', gap: 16 }}>
                  <TimeInput label="Start" value={start} onChange={setStart} maxDuration={metadata.duration} />
                  <TimeInput label="End" value={end} onChange={setEnd} maxDuration={metadata.duration} />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={addClip}
                  style={{ height: '36px', padding: '0 24px' }}
                >
                  Add Clip
                </button>
              </div>
            </div>

            {clips.length > 0 && (
              <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ fontSize: 16, fontWeight: 600 }}>Clips Queue ({clips.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clips.map((clip) => (
                    <div key={clip.id} className="glass" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 20px',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{clip.name}</span>
                        <span style={{ marginLeft: 16, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {formatTime(clip.start)} → {formatTime(clip.end)}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                          ({(clip.end - clip.start).toFixed(1)}s)
                        </span>
                      </div>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => removeClip(clip.id)} 
                        style={{ padding: '4px 12px', fontSize: '11px', height: '28px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={downloadAllClips} 
                    style={{ padding: '14px 48px', fontSize: 16, borderRadius: 'var(--radius-xl)' }}
                  >
                    Download All Clips
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
