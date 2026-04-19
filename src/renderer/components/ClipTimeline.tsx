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

  const startPercent = (start / duration) * 100;
  const endPercent = (end / duration) * 100;

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
    <div style={{ marginTop: 12 }}>
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          height: 40,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        {/* Selected region */}
        <div style={{
          position: 'absolute',
          left: `${startPercent}%`,
          width: `${endPercent - startPercent}%`,
          height: '100%',
          background: 'rgba(99, 102, 241, 0.3)',
          borderRadius: 8,
        }} />

        {/* Start handle */}
        <div
          onMouseDown={handleMouseDown('start')}
          style={{
            position: 'absolute',
            left: `${startPercent}%`,
            top: 0,
            bottom: 0,
            width: 4,
            background: '#6366F1',
            borderRadius: 4,
            cursor: 'ew-resize',
            transform: 'translateX(-2px)',
          }}
        />

        {/* End handle */}
        <div
          onMouseDown={handleMouseDown('end')}
          style={{
            position: 'absolute',
            left: `${endPercent}%`,
            top: 0,
            bottom: 0,
            width: 4,
            background: '#6366F1',
            borderRadius: 4,
            cursor: 'ew-resize',
            transform: 'translateX(-2px)',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        <span>{formatTime(start)}</span>
        <span>Clip: {formatTime(end - start)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
