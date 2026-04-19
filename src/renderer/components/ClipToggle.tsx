// src/renderer/components/ClipToggle.tsx
import { useState } from 'react';

interface ClipToggleProps {
  children: React.ReactNode;
  duration: number; // total video duration in seconds
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
}

export default function ClipToggle({ children, duration, expanded, onToggle }: ClipToggleProps) {
  if (duration <= 0) return null;

  return (
    <div>
      <button
        className="btn"
        onClick={() => onToggle(!expanded)}
        style={{ marginTop: 12 }}
      >
        {expanded ? 'Hide Clip Picker' : 'Download Clip'}
      </button>
      {expanded && (
        <div className="glass" style={{ padding: 16, marginTop: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}
