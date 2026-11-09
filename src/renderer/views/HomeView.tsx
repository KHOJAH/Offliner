// src/renderer/views/HomeView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/renderer/stores/themeStore';

export default function HomeView() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isMonochrome = theme === 'monochrome';
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
        {/* Ambient Daylight / Soft Studio Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/2 left-1/4 w-[420px] h-[420px] bg-surface-container-highest/20 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center relative z-10">
          {/* Overline Native Engine Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 mb-6 shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isMonochrome ? 'bg-white' : 'bg-emerald-500'
              } animate-pulse`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Native Engine Active
            </span>
            <span className="text-[11px] text-text-secondary opacity-40">/</span>
            <span className="text-[11px] font-mono text-primary font-medium">yt-dlp 2025.02</span>
          </div>

          {/* Hero Title */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-text-primary mb-3">
            OFFLINER
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-text-secondary max-w-xl mb-10 leading-relaxed font-normal">
            Experience the fastest, most elegant way to capture your favorite content. Clean lossless
            stream ripping directly to your workspace.
          </p>

          {/* Omnibox / Universal Input Bar */}
          <div className="w-full relative mb-4">
            <form
              role="form"
              onSubmit={handleSubmit}
              className="group relative flex items-center bg-surface border border-outline-variant/40 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-2 transition-all duration-300 focus-within:border-primary focus-within:shadow-[0_8px_32px_rgba(0,113,227,0.12)]"
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

          {/* Synthesized Stream Inspector (Simulated Dynamic Detection) */}
          {url.trim() && (
            <div className="w-full mb-8 p-3 rounded-xl bg-surface border border-outline-variant/30 shadow-xs flex items-center justify-between text-left animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  smart_display
                </span>
                <span className="text-xs font-mono text-text-secondary truncate">
                  Parsed: {url.trim().substring(0, 48)}...
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                  4K 60fps VP9
                </span>
                <span className="text-[10px] font-mono bg-surface-container text-text-secondary px-2 py-0.5 rounded font-medium">
                  320kbps Opus
                </span>
              </div>
            </div>
          )}

          {/* Quick Action Matrix (3 Cards Grid) */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {/* Card 01: Video */}
            <div
              onClick={() => (url.trim() ? navigate('/video', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/video'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">movie</span>
                </div>
                <span className="text-xs font-mono text-text-secondary opacity-70">01</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Video</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Full HD & 4K HDR direct passthrough
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>Lossless MP4/MKV</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>

            {/* Card 02: Audio */}
            <div
              onClick={() => (url.trim() ? navigate('/audio', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/audio'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
                </div>
                <span className="text-xs font-mono text-text-secondary opacity-70">02</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Audio</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Studio Quality bit-for-bit extraction
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>FLAC, M4A & MP3</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>

            {/* Card 03: Clips */}
            <div
              onClick={() => (url.trim() ? navigate('/clips', { state: { url: url.trim(), autoAnalyze: true } }) : navigate('/clips'))}
              className="group bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-xs transition-all duration-200 text-left hover:shadow-md hover:border-outline-variant/60 cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">content_cut</span>
                </div>
                <span className="text-xs font-mono text-text-secondary opacity-70">03</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Clips</h3>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Precise Trimming with keyframe snapping
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span>Range Export</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </div>
            </div>
          </div>

          {/* Engine Compatibility Badges Strip */}
          <div className="flex flex-col items-center gap-3 mb-10">
            <span className="text-[11px] uppercase tracking-wider text-text-secondary font-medium">
              Engine Compatibility
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface shadow-xs border border-outline-variant/15">
                <span className="material-symbols-outlined text-[16px] text-text-secondary">
                  play_circle
                </span>
                <span className="text-xs font-medium">YouTube</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface shadow-xs border border-outline-variant/15">
                <span className="material-symbols-outlined text-[16px] text-text-secondary">
                  bolt
                </span>
                <span className="text-xs font-medium">YouTube Shorts</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface shadow-xs border border-outline-variant/15">
                <span className="material-symbols-outlined text-[16px] text-text-secondary">
                  music_note
                </span>
                <span className="text-xs font-medium">YouTube Music</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface shadow-xs border border-outline-variant/15">
                <span className="material-symbols-outlined text-[16px] text-text-secondary">
                  sensors
                </span>
                <span className="text-xs font-medium">YouTube Live (DVR)</span>
              </div>
            </div>
          </div>

          {/* Real-Time Activity & Precision Metrics Row */}
          <div className="w-full max-w-3xl flex items-center justify-between px-6 py-4 rounded-xl bg-surface border border-outline-variant/30 shadow-xs mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isMonochrome ? 'bg-white' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-xs font-semibold text-text-primary">Pipeline Daemon</span>
              </div>
              <span className="text-xs font-mono text-text-secondary">SSL Cert Verified</span>
              <span className="text-xs font-mono text-text-secondary opacity-40">|</span>
              <span className="text-xs font-mono text-text-secondary">FFmpeg 7.1 Hardlinked</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-text-secondary uppercase tracking-wider font-semibold">
                Format Engine
              </span>
              <span className="text-xs font-mono bg-surface-container px-2 py-0.5 rounded text-text-primary font-medium">
                Opus / AV1 / H.265
              </span>
            </div>
          </div>

          {/* Centered Studio Subtle Footer Bar */}
          <div className="w-full max-w-3xl pt-2 flex items-center justify-between text-text-secondary text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-low text-text-secondary font-medium border border-outline-variant/15">
                v2.4.0 Native
              </span>
              <span>Universal Desktop Binary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-mono font-medium">Ready • yt-dlp 2025.02</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
