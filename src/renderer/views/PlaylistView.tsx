// src/renderer/views/PlaylistView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import URLInput from '@/components/URLInput';
import VideoPreview from '@/components/VideoPreview';
import { ipcClient } from '@/ipc/client';
import { useUIStore } from '@/stores/uiStore';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  const downloadPath = useSettingsStore((s) => s.downloadPath);

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
      // Clear state so it doesn't re-fire
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

  return (
    <div className="page-container">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Download Playlist</h2>
        <URLInput 
          onURL={handleURL} 
          loading={loading} 
          placeholder="Paste playlist link here..." 
          initialValue={location.pathname === '/playlist' ? location.state?.url : undefined} 
        />

        {metadata && (
          <div className="page-enter" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
              <VideoPreview metadata={metadata} />
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', uppercase: 'true', letterSpacing: '0.05em' } as any}>MODE</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className={mode === 'video' ? 'btn btn-primary' : 'btn'} 
                      onClick={() => setMode('video')}
                      style={{ padding: '8px 20px' }}
                    >
                      Video
                    </button>
                    <button 
                      className={mode === 'audio' ? 'btn btn-primary' : 'btn'} 
                      onClick={() => setMode('audio')}
                      style={{ padding: '8px 20px' }}
                    >
                      Audio
                    </button>
                  </div>
                </div>

                {mode === 'video' ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', uppercase: 'true', letterSpacing: '0.05em' } as any}>FORMAT</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          className={videoFormat === 'mp4' ? 'btn btn-primary' : 'btn'} 
                          onClick={() => setVideoFormat('mp4')}
                          style={{ padding: '8px 16px' }}
                        >
                          MP4
                        </button>
                        <button 
                          className={videoFormat === 'mkv' ? 'btn btn-primary' : 'btn'} 
                          onClick={() => setVideoFormat('mkv')}
                          style={{ padding: '8px 16px' }}
                        >
                          MKV
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', uppercase: 'true', letterSpacing: '0.05em' } as any}>QUALITY</span>
                      <select 
                        value={videoQuality} 
                        onChange={(e) => setVideoQuality(e.target.value)}
                        className="input"
                        style={{ padding: '8px 12px', height: '36px', minWidth: '140px' }}
                      >
                        {qualities.map(q => (
                          <option key={q.value} value={q.value}>{q.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', uppercase: 'true', letterSpacing: '0.05em' } as any}>AUDIO FORMAT</span>
                    <select 
                      value={audioFormat} 
                      onChange={(e) => setAudioFormat(e.target.value)}
                      className="input"
                      style={{ padding: '8px 12px', height: '36px', minWidth: '160px' }}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedItems.size} Selected
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {metadata.entries?.length || 0} total items in playlist
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn" onClick={toggleSelectAll}>
                    {selectedItems.size === (metadata.entries?.length || 0) ? 'Deselect All' : 'Select All'}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={downloadSelected} 
                    disabled={selectedItems.size === 0}
                    style={{ padding: '8px 24px', borderRadius: 'var(--radius-xl)' }}
                  >
                    Download Items
                  </button>
                </div>
              </div>
            </div>

            <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ maxHeight: 400, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {metadata.entries?.map((entry) => {
                  const isSelected = selectedItems.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleItem(entry.id)}
                      style={{
                        display: 'flex',
                        gap: 16,
                        padding: 12,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
                        transition: 'all var(--transition-fast)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--text-tertiary)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        flexShrink: 0,
                        marginTop: 12
                      }}>
                        {isSelected && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%' }} />}
                      </div>
                      <img 
                        src={entry.thumbnail || metadata.thumbnail} 
                        alt="" 
                        style={{ width: 100, height: 56, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} 
                      />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)', marginBottom: 4 }}>
                          {entry.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {entry.duration ? `${Math.floor(entry.duration / 60)}:${String(entry.duration % 60).padStart(2, '0')}` : 'Duration unknown'}
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
    </div>
  );
}
