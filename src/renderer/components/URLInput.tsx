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

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setValue(text.trim());
      }
    } catch {
      // In tests or restricted browser contexts, clipboard readText may fail gracefully
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="URL Input Form"
      className="glass flex items-center gap-2 p-1.5 pl-4 rounded-2xl border border-[var(--border-hairline)] max-w-3xl w-full mx-auto shadow-md focus-within:border-[var(--accent)] focus-within:shadow-lg transition-all"
    >
      {/* Leading link icon */}
      <svg
        className="w-5 h-5 text-[var(--text-tertiary)] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>

      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || 'Paste YouTube URL here...'}
        disabled={loading}
        className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-tertiary)] font-sans text-sm md:text-base py-2.5 px-2 min-w-0"
      />

      {/* Clear button */}
      {value && !loading && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Clear input"
          className="p-1.5 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Paste button */}
      <button
        type="button"
        onClick={handlePaste}
        disabled={loading}
        aria-label="Paste from clipboard"
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer active:scale-95 shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span>Paste</span>
      </button>

      {/* Submit / Analyze button */}
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className={`flex items-center justify-center px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all shadow-sm active:scale-95 shrink-0 select-none ${
          loading || !value.trim()
            ? 'opacity-60 cursor-not-allowed bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-hairline)]'
            : 'bg-[var(--accent)] hover:brightness-105 text-[var(--accent-text)] cursor-pointer'
        }`}
      >
        {loading ? 'ANALYZING...' : 'ANALYZE'}
      </button>
    </form>
  );
}

