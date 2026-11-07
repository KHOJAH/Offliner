/**
 * src/engine/ytdlp/builder.ts
 * Pure CLI argument builders for yt-dlp operations.
 */

import { join } from 'path';

export interface ClipRange {
  name?: string;
  start: number; // In seconds
  end: number;   // In seconds
}

export type SupportedAudioFormat = 'mp3' | 'm4a' | 'flac' | 'wav' | 'opus' | 'aac';
export type VideoContainerFormat = 'mp4' | 'mkv' | 'webm' | string;

export interface DownloadOptions {
  url: string;
  mode?: 'video' | 'audio' | 'clip' | 'playlist';
  format?: string;
  videoFormat?: VideoContainerFormat;
  outputPath?: string;
  outputTemplate?: string;
  extractAudio?: boolean;
  audioFormat?: SupportedAudioFormat | string;
  audioQuality?: number; // 0 (best) to 9 (smallest)
  clips?: ClipRange[];
  isPlaylist?: boolean;
  noPlaylist?: boolean;
  continueDownload?: boolean; // For pause-resume byte stream continuation
  ffmpegPath?: string | null;
  jsRuntimes?: string[];
  extraArgs?: string[];
}

export interface MetadataOptions {
  noPlaylist?: boolean;
  flatPlaylist?: boolean;
  extraArgs?: string[];
}

export interface BinaryContext {
  ffmpegPath?: string | null;
  jsRuntimes?: string[];
}

export const MAX_QUALITY_FORMAT =
  'bestvideo[protocol!*=m3u8]+bestaudio[protocol!*=m3u8]/best[protocol!*=m3u8]/best';

export const CLIP_AUDIO_FORMAT = 'bestaudio[protocol!*=m3u8]/best';

export const DEFAULT_PLAYER_CLIENT = 'youtube:player_client=web_embedded,web';
export const DEFAULT_JS_RUNTIMES = ['deno', 'node'];

export function isAudioExtraction(options: DownloadOptions): boolean {
  return Boolean(options.extractAudio || options.mode === 'audio');
}

export function buildFormatString(options: DownloadOptions): string | undefined {
  const isAudio = isAudioExtraction(options);

  if (isAudio) {
    if (options.clips && options.clips.length > 0) {
      return CLIP_AUDIO_FORMAT;
    }
    return undefined;
  }

  if (options.format && options.format !== 'undefined' && options.format !== 'null') {
    let fmt = options.format.trim();
    if (!fmt) {
      return options.clips && options.clips.length > 0 ? MAX_QUALITY_FORMAT : undefined;
    }
    if (fmt === 'best' || fmt === 'b') {
      return MAX_QUALITY_FORMAT;
    }
    // Single format ID (e.g. '137' or '18') without + or [
    if (!fmt.includes('+') && !fmt.includes('[')) {
      return `${fmt}+bestaudio[protocol!*=m3u8]/${MAX_QUALITY_FORMAT}`;
    }
    // Format with + but missing protocol filtering on bestaudio
    if (fmt.includes('+') && !fmt.includes('[protocol!*=m3u8]')) {
      return fmt.replace(/\+bestaudio(\/best)?\b/, `+bestaudio[protocol!*=m3u8]/${MAX_QUALITY_FORMAT}`);
    }
    // Bracketed format (e.g. best[height<=720])
    if (fmt.startsWith('b[') || fmt.startsWith('best[')) {
      if (!fmt.includes('protocol!*=m3u8')) {
        return fmt.replace(/\]$/, '][protocol!*=m3u8]');
      }
    }
    return fmt;
  }

  if (options.clips && options.clips.length > 0) {
    return MAX_QUALITY_FORMAT;
  }

  return undefined;
}

export function buildDownloadArgs(
  options: DownloadOptions,
  context?: BinaryContext
): string[] {
  const args: string[] = [];
  const isAudio = isAudioExtraction(options);

  // 1. Format Selection (-f)
  const formatStr = buildFormatString(options);
  if (formatStr) {
    args.push('-f', formatStr);
  }

  // 2. Audio Extraction Flags
  if (isAudio) {
    args.push('-x');
    if (options.audioFormat) {
      args.push('--audio-format', options.audioFormat.toLowerCase());
    }
    if (options.audioQuality !== undefined) {
      args.push('--audio-quality', String(options.audioQuality));
    }
  }

  // 3. Clipping Flags
  if (options.clips && options.clips.length > 0) {
    for (const clip of options.clips) {
      const start = Math.max(0, clip.start);
      const end = clip.end > start ? clip.end : start + 1;
      args.push('--download-sections', `*${start}-${end}`);
    }
    if (!isAudio) {
      args.push('--force-keyframes-at-cuts');
    }
    args.push('--downloader-args', 'ffmpeg_i:-short_seek_size 1');
  }

  // 4. Output Destination (--output)
  if (options.outputPath) {
    let outputTemplate = '%(title)s.%(ext)s';
    if (options.clips && options.clips.length > 0) {
      outputTemplate = '%(title)s - %(section_start)s-%(section_end)s.%(ext)s';
    }
    if (options.outputTemplate) {
      outputTemplate = options.outputTemplate;
    }
    const target =
      /\.[a-zA-Z0-9]{2,4}$/.test(options.outputPath) &&
      (!options.clips || options.clips.length === 0) &&
      !options.outputTemplate
        ? options.outputPath
        : join(options.outputPath, outputTemplate);
    args.push('--output', target);
  }

  // 5. Video Container & Remux
  if (!isAudio) {
    const container = options.videoFormat || 'mp4';
    args.push('--merge-output-format', container);
    args.push('--remux-video', container);
  }

  // 6. Standard Sanitization & Protocol Flags
  args.push('--newline', '--force-overwrites', '--restrict-filenames');
  args.push('--no-check-certificates');
  args.push('--no-update');
  args.push('--format-sort', 'proto');

  // 7. JS Runtimes
  const runtimes =
    context?.jsRuntimes && context.jsRuntimes.length > 0
      ? context.jsRuntimes
      : options.jsRuntimes && options.jsRuntimes.length > 0
        ? options.jsRuntimes
        : DEFAULT_JS_RUNTIMES;

  for (const rt of runtimes) {
    args.push('--js-runtimes', rt);
  }

  // 8. Extractor Arguments
  args.push('--extractor-args', DEFAULT_PLAYER_CLIENT);

  // 9. Audio Multistream Control (Duplicate Echo Prevention)
  if (isAudio) {
    args.push('--audio-multistreams');
  } else {
    args.push('--no-audio-multistreams');
  }

  // 10. FFmpeg Location
  const ffmpeg = context?.ffmpegPath !== undefined ? context.ffmpegPath : options.ffmpegPath;
  if (ffmpeg) {
    args.push('--ffmpeg-location', ffmpeg);
  }

  // 11. Playlist Controls
  if (options.isPlaylist) {
    args.push('--yes-playlist');
  } else if (options.noPlaylist) {
    args.push('--no-playlist');
  }

  // 12. Resume Continuation
  if (options.continueDownload) {
    args.push('--continue');
  }

  // 13. Extra Custom Arguments
  if (options.extraArgs && options.extraArgs.length > 0) {
    args.push(...options.extraArgs);
  }

  // 14. URL (always final, preceded by POSIX end-of-options delimiter to prevent option injection)
  args.push('--', options.url);

  return args;
}

export function buildMetadataArgs(
  url: string,
  options: MetadataOptions = {},
  context?: BinaryContext
): string[] {
  const args: string[] = [
    '--dump-single-json',
    '--no-download',
    '--no-warnings',
    '--no-update',
    '--format-sort',
    'proto',
  ];

  const runtimes =
    context?.jsRuntimes && context.jsRuntimes.length > 0
      ? context.jsRuntimes
      : DEFAULT_JS_RUNTIMES;

  for (const rt of runtimes) {
    args.push('--js-runtimes', rt);
  }

  args.push('--extractor-args', DEFAULT_PLAYER_CLIENT);

  if (options.noPlaylist) {
    args.push('--no-playlist');
  }

  if (options.flatPlaylist || url.includes('list=') || url.includes('playlist?')) {
    args.push('--flat-playlist');
  }

  if (options.extraArgs && options.extraArgs.length > 0) {
    args.push(...options.extraArgs);
  }

  // URL (preceded by POSIX end-of-options delimiter to prevent option injection)
  args.push('--', url);
  return args;
}
