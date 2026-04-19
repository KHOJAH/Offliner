// src/renderer/components/FormatSelector.tsx
import type { FormatInfo } from '@/types';

interface FormatSelectorProps {
  formats: FormatInfo[];
  selected?: string;
  onSelect: (formatId: string) => void;
  mode?: 'video' | 'audio' | 'both';
}

export default function FormatSelector({ formats, selected, onSelect, mode = 'both' }: FormatSelectorProps) {
  // Group by resolution
  // Show all video formats (with or without audio)
  const videoFormats = formats.filter((f) => f.vcodec !== 'none' && (mode === 'video' || mode === 'both'));
  const audioFormats = formats.filter((f) => f.acodec !== 'none' && f.vcodec === 'none' && (mode === 'audio' || mode === 'both'));

  const resolutions = [...new Set(videoFormats.map((f) => f.resolution || 'unknown'))].sort((a, b) => {
    const resA = parseInt(a.split('x')[1] || a) || 0;
    const resB = parseInt(b.split('x')[1] || b) || 0;
    return resB - resA;
  });

  return (
    <div>
      {videoFormats.length > 0 && (
        <>
          <h4 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Video Quality</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {resolutions.map((res) => {
              const format = videoFormats.find((f) => f.resolution === res);
              if (!format) return null;
              const isSelected = selected === format.format_id;
              return (
                <button
                  key={format.format_id}
                  onClick={() => onSelect(format.format_id)}
                  className={isSelected ? 'btn btn-primary' : 'btn'}
                  style={{ minWidth: 80 }}
                >
                  {res}
                  {format.fps && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{format.fps}fps</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {audioFormats.length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Audio Only</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {audioFormats.slice(0, 5).map((format) => {
              const isSelected = selected === format.format_id;
              return (
                <button
                  key={format.format_id}
                  onClick={() => onSelect(format.format_id)}
                  className={isSelected ? 'btn btn-primary' : 'btn'}
                >
                  {format.abr ? `${format.abr}kbps` : format.acodec}
                  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: isSelected ? 'white' : 'var(--text-secondary)' }}>• {format.ext}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
