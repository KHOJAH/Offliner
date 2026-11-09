// src/renderer/views/HomeView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomeView() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    const isPlaylist = trimmed.includes('list=') || trimmed.includes('playlist?');
    if (isPlaylist) {
      navigate('/playlist', { state: { url: trimmed, autoAnalyze: true } });
    } else {
      navigate('/video', { state: { url: trimmed, autoAnalyze: true } });
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text);
          return;
        }
      }
    } catch {}
    setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  };

  return (
    <div className="flex flex-col w-full relative">
      <section className="relative w-full px-8 py-10 overflow-hidden flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/2 left-1/4 w-[420px] h-[420px] bg-surface-container-highest/20 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center relative z-10">
          {/* Overline Native Engine Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Native Engine Active
            </span>
          </div>

          {/* Hero Title */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-text-primary mb-3">
            OFFLINER
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-text-secondary max-w-xl mb-10 leading-relaxed font-normal">
            Fast, minimal desktop media downloader.
          </p>

          {/* Omnibox / Universal Input Bar */}
          <div className="w-full max-w-2xl relative mb-10">
            <form
              role="form"
              onSubmit={handleSubmit}
              className="group relative flex items-center bg-surface border border-outline-variant/40 rounded-2xl shadow-xs p-2 transition-all duration-300 focus-within:border-primary focus-within:shadow-md"
            >
              <div className="pl-3.5 pr-2 flex items-center justify-center text-text-secondary">
                <span className="material-symbols-outlined text-[20px]">link</span>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video or playlist link here... (e.g., https://youtube.com/watch?v=...)"
                className="w-full bg-transparent border-none outline-none font-mono text-sm text-text-primary placeholder:text-text-secondary placeholder:font-sans placeholder:font-normal"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1.5 text-text-secondary hover:text-text-primary rounded-md transition-colors mr-1"
                  title="Clear URL"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1"
                  title="Paste from clipboard"
                >
                  <span className="material-symbols-outlined text-[14px]">content_paste</span>
                  <span>Paste</span>
                </button>
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-medium text-xs tracking-wide transition-all shadow-sm flex items-center gap-1.5 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>{loading ? 'ANALYZING...' : 'ANALYZE'}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Action Matrix (3 Cards Grid) */}
          <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {/* Card: Video */}
            <div
              onClick={() => (url.trim() ? navigate('/video', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/video'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary mb-3">
                <span className="material-symbols-outlined text-[20px]">movie</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Video</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Download video in high resolution
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>Select</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>

            {/* Card: Audio */}
            <div
              onClick={() => (url.trim() ? navigate('/audio', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/audio'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary mb-3">
                <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Audio</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Extract audio in pristine quality
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>Select</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>

            {/* Card: Clips */}
            <div
              onClick={() => (url.trim() ? navigate('/clips', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/clips'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary mb-3">
                <span className="material-symbols-outlined text-[20px]">content_cut</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Clips</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Trim and save custom segments
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>Select</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>
          </div>

          {/* Centered Minimal Footer */}
          <div className="w-full max-w-4xl pt-2 flex items-center justify-center text-text-secondary text-xs">
            <span className="text-[11px] text-text-tertiary">
              Fast, private & minimal
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
