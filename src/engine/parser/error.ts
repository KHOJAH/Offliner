/**
 * src/engine/parser/error.ts
 * Comprehensive error parser and classifier for yt-dlp and FFmpeg process output.
 */

import { stripAnsi } from './progress';
import type { ParsedError, ErrorCategory } from './types';

interface ErrorPatternDef {
  category: ErrorCategory;
  isTransient: boolean;
  pattern: RegExp;
  userMessage: string | ((match: RegExpMatchArray) => string);
}

const ERROR_PATTERNS: ErrorPatternDef[] = [
  // 1. Private video / Members only
  {
    category: 'private_video',
    isTransient: false,
    pattern: /Private video|This video is private|Join this channel to get access to members-only content/i,
    userMessage: 'This video is private or restricted to members. Sign-in is required.',
  },
  // 2. Video unavailable / Removed / Terminated
  {
    category: 'video_unavailable',
    isTransient: false,
    pattern: /Video unavailable|This video has been removed|account associated with this video has been terminated|Incomplete YouTube ID|not a valid URL|Unsupported URL/i,
    userMessage: 'Video is unavailable, deleted, or the URL is invalid.',
  },
  // 3. Age-gate / Authentication / Bot check
  {
    category: 'age_restricted',
    isTransient: false,
    pattern: /Sign in to confirm your age|Age-restricted video|Sign in to confirm you(?:'|’)?re not a bot/i,
    userMessage: 'This video is age-restricted or requires bot verification/sign-in.',
  },
  // 4. Format not available
  {
    category: 'format_unavailable',
    isTransient: false,
    pattern: /Requested format is not available|No (?:video|audio) formats found/i,
    userMessage: 'The requested resolution or format is not available for this video.',
  },
  // 5. Geo-restricted / Country blocked
  {
    category: 'geo_restricted',
    isTransient: false,
    pattern: /not made this video available in your country|blocked it in your country/i,
    userMessage: 'This video is blocked in your country due to geographic copyright restrictions.',
  },
  // 6. Transient Network Failures
  {
    category: 'network',
    isTransient: true,
    pattern: /urlopen error|timed? out|Connection (?:refused|reset)|Remote end closed connection|HTTP Error 50[0234]|Network is unreachable|Temporary failure in name resolution/i,
    userMessage: 'Network connection timed out or failed. Retrying...',
  },
  // 7. Disk space
  {
    category: 'disk_space',
    isTransient: false,
    pattern: /No space left on device|\[Errno 28\]/i,
    userMessage: 'Download failed: Not enough disk space on the target drive.',
  },
  // 8. Permission denied
  {
    category: 'permission_denied',
    isTransient: false,
    pattern: /Permission denied|\[Errno 13\]/i,
    userMessage: 'Download failed: Permission denied when writing to destination folder.',
  },
  // 9. Tool missing
  {
    category: 'tool_missing',
    isTransient: false,
    pattern: /ffmpeg not found|ffprobe not found|command not found: (?:ffmpeg|yt-dlp)/i,
    userMessage: 'FFmpeg or yt-dlp binary is missing or not found on the system.',
  },
];

export function extractVideoId(text: string): string | undefined {
  const match = text.match(/(?:\[youtube\]|video:)\s*([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : undefined;
}

export function parseError(stderrOrError: string | Error, exitCode?: number): ParsedError {
  const raw =
    typeof stderrOrError === 'string'
      ? stderrOrError
      : stderrOrError?.message || String(stderrOrError);

  const clean = stripAnsi(raw).trim();
  const videoId = extractVideoId(clean);

  // Match against specific error taxonomy patterns
  for (const def of ERROR_PATTERNS) {
    const match = clean.match(def.pattern);
    if (match) {
      const userMessage =
        typeof def.userMessage === 'function' ? def.userMessage(match) : def.userMessage;
      return {
        category: def.category,
        isTransient: def.isTransient,
        userMessage,
        rawMessage: clean,
        videoId,
        exitCode,
      };
    }
  }

  // Extract explicit ERROR: line if available
  const errorLineMatch = clean.match(/ERROR:\s*(.+)$/m);
  const fallbackMessage = errorLineMatch ? errorLineMatch[1].trim() : clean || 'An unexpected error occurred';

  return {
    category: 'unknown',
    isTransient: false,
    userMessage: fallbackMessage,
    rawMessage: clean,
    videoId,
    exitCode,
  };
}

export function isTransientError(stderrOrError: string | Error): boolean {
  return parseError(stderrOrError).isTransient;
}
