// src/renderer/components/URLInput.tsx
import { useState, useEffect } from 'react';

interface URLInputProps {
  onURL: (url: string) => void;
  loading?: boolean;
  placeholder?: string;
  initialValue?: string;
}

export default function URLInput({ onURL, loading, placeholder, initialValue }: URLInputProps) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onURL(value.trim());
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      aria-label="URL Input Form" 
      className="glass"
      style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        alignItems: 'center',
        padding: '8px 8px 8px 24px',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 800,
        margin: '0 auto',
        boxShadow: 'var(--shadow-md)',
        transition: 'var(--transition-normal)',
      }}
    >
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || 'Paste YouTube URL here...'}
        style={{ 
          flex: 1, 
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: '"Inter", sans-serif',
          fontSize: 16,
          color: 'var(--text-primary)',
          padding: '12px 0',
        }}
        disabled={loading}
      />
      <button 
        type="submit" 
        className="btn-primary" 
        style={{ 
          padding: '12px 32px',
          borderRadius: 'var(--radius-lg)',
          fontSize: 16,
          fontWeight: 700,
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          border: 'none',
          cursor: 'pointer',
          transition: 'var(--transition-normal)',
          transform: loading ? 'scale(0.95)' : 'none',
          opacity: loading || !value.trim() ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
        disabled={loading || !value.trim()}
      >
        {loading ? 'ANALYZING...' : 'ANALYZE'}
      </button>
    </form>
  );
}
