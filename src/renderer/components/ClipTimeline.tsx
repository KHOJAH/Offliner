// src/renderer/components/ClipTimeline.tsx
import { useState, useRef, useEffect } from 'react';

interface ClipTimelineProps {
  duration: number;
  start: number;
  end: number;
  onStartChange: (start: number) => void;
  onEndChange: (end: number) => void;
}

export default function ClipTimeline({ duration, start, end, onStartChange, onEndChange }: ClipTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const startPercent = duration > 0 ? Math.max(0, Math.min(100, (start / duration) * 100)) : 0;
  const endPercent = duration > 0 ? Math.max(0, Math.min(100, (end / duration) * 100)) : 0;

  const handleMouseDown = (type: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(type);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const seconds = Math.round((x / rect.width) * duration);
      if (dragging === 'start') {
        onStartChange(Math.min(seconds, end - 1)); // Min 1 second clip
      } else {
        onEndChange(Math.max(seconds, start + 1));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, duration, end, onEndChange, onStartChange, start]);

  return (
    <div className="mt-3">
      <div
        ref={trackRef}
        className="relative h-10 rounded-xl overflow-hidden cursor-pointer border border-[var(--border-hairline)]"
        style={{
          background: 'var(--bg-surface-elevated)',
        }}
      >
        {/* Subtle grid pattern / waveform placeholder */}
        <div className="absolute inset-0 opacity-15 flex items-center justify-around pointer-events-none px-2">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full bg-[var(--text-tertiary)]"
              style={{ height: `${20 + ((i * 17) % 65)}%` }}
            />
          ))}
        </div>

        {/* Selected region */}
        <div
          className="absolute top-0 bottom-0 border-y border-[var(--accent)]"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
            background: 'var(--accent-subtle)',
          }}
        />

        {/* Start handle */}
        <div
          onMouseDown={handleMouseDown('start')}
          role="slider"
          aria-label="Clip start handle"
          aria-valuenow={start}
          className="absolute top-0 bottom-0 w-3 rounded-l-md flex items-center justify-center cursor-ew-resize shadow-md z-10 transition-transform active:scale-105"
          style={{
            left: `${startPercent}%`,
            background: 'var(--accent)',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="w-0.5 h-4 rounded-full bg-[var(--accent-text)] opacity-70" />
        </div>

        {/* End handle */}
        <div
          onMouseDown={handleMouseDown('end')}
          role="slider"
          aria-label="Clip end handle"
          aria-valuenow={end}
          className="absolute top-0 bottom-0 w-3 rounded-r-md flex items-center justify-center cursor-ew-resize shadow-md z-10 transition-transform active:scale-105"
          style={{
            left: `${endPercent}%`,
            background: 'var(--accent)',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="w-0.5 h-4 rounded-full bg-[var(--accent-text)] opacity-70" />
        </div>
      </div>

      <div className="flex justify-between items-center mt-1.5 text-xs font-mono text-[var(--text-secondary)]">
        <span className="tabular-nums">{formatTime(start)}</span>
        <span className="font-sans font-medium text-[var(--text-primary)] px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)]">
          Clip: <span className="font-mono text-[var(--accent)]">{formatTime(end - start)}</span>
        </span>
        <span className="tabular-nums">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
