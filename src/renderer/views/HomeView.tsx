// src/renderer/views/HomeView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import URLInput from '@/renderer/components/URLInput';

export default function HomeView() {
  const navigate = useNavigate();
  const [loading] = useState(false);

  const handleURL = (url: string) => {
    if (!url.trim()) return;

    const isPlaylist = url.includes('list=') || url.includes('playlist?');
    if (isPlaylist) {
      navigate('/playlist', { state: { url, autoAnalyze: true } });
    } else {
      navigate('/video', { state: { url, autoAnalyze: true } });
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col justify-center items-center py-12 px-4 overflow-hidden">
      {/* Ambient Daylight / Accent Glow */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] rounded-full blur-3xl pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-3xl mx-auto text-center relative z-10">
        {/* Overline Native Engine Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] shadow-xs mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Native Engine Active
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">/</span>
          <span className="text-[11px] font-mono font-medium text-[var(--accent)]">
            yt-dlp 2025.02
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] mb-3">
          OFFLINER
        </h1>
        <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed font-normal">
          Universal media capture engine with precision trimming, lossless extraction, and batch queueing.
        </p>

        {/* Omnibox URL Input */}
        <div className="mb-10">
          <URLInput
            onURL={handleURL}
            loading={loading}
            placeholder="Paste video or playlist link here..."
          />
        </div>

        {/* 3 Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
          <QuickActionCard
            index="01"
            title="Video"
            subtitle="Full HD Downloads"
            description="Up to 4K 60fps with seamless DASH video & audio merging."
            link="Lossless MP4/MKV →"
            icon={
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            onClick={() => navigate('/video')}
          />
          <QuickActionCard
            index="02"
            title="Audio"
            subtitle="Studio Quality"
            description="Bit-perfect FLAC, M4A, OPUS, WAV & MP3 extraction."
            link="DSP Codecs →"
            icon={
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            }
            onClick={() => navigate('/audio')}
          />
          <QuickActionCard
            index="03"
            title="Clips"
            subtitle="Precise Trimming"
            description="Keyframe-accurate timeline scrubber & multi-clip builder."
            link="Range Export →"
            icon={
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879a3 3 0 11-4.242-4.242l2.879-2.879m0 0a3 3 0 114.242-4.242L12 7.758" />
              </svg>
            }
            onClick={() => navigate('/clips')}
          />
        </div>

        {/* Platform Compatibility Strip */}
        <div className="glass rounded-2xl p-4 border border-[var(--border-hairline)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="font-semibold text-[var(--text-primary)]">Supported Sources:</span>
            {['YouTube', 'YouTube Shorts', 'YouTube Music', 'Playlists'].map((platform) => (
              <span
                key={platform}
                className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] font-medium text-[11px]"
              >
                {platform}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            <span>FFmpeg 7.1 Hardlinked</span>
            <span>•</span>
            <span>Opus / AV1 / H.265</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  index,
  title,
  subtitle,
  description,
  link,
  icon,
  onClick,
}: {
  index: string;
  title: string;
  subtitle: string;
  description: string;
  link: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="glass p-5 rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--accent)] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] flex items-center justify-center">
            {icon}
          </div>
          <span className="font-mono text-xs font-semibold text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors">
            #{index}
          </span>
        </div>

        <h3 className="font-bold text-base text-[var(--text-primary)] mb-0.5">
          {title}
        </h3>
        <p className="text-xs font-medium text-[var(--accent)] mb-2">
          {subtitle}
        </p>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
        <span>{link}</span>
      </div>
    </div>
  );
}

