/**
 * src/engine/parser/progress.ts
 * High-performance, robust stream progress parser for yt-dlp and FFmpeg.
 */

import type {
  StreamProgressUpdate,
  ParseProgressOptions,
} from './types';

// Fast ANSI escape sequence stripper
const ANSI_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/g;

export function stripAnsi(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(ANSI_REGEX, '');
}

/**
 * Robust regex for yt-dlp download lines:
 * Group 1: Percent (e.g. "45.2")
 * Group 2: Total size value (e.g. "5.32")
 * Group 3: Total size unit (e.g. "MiB")
 * Group 4: Elapsed/completion time (e.g. "00:45")
 * Group 5: Speed value (e.g. "1.23")
 * Group 6: Speed unit (e.g. "MiB/s")
 * Group 7: ETA (e.g. "03:15" or "01:02:03")
 */
const YTDLP_REGEX =
  /\[download\]\s+(\d+(?:\.\d+)?)%(?:\s+of[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+))?(?:\s+\([^)]+\))?(?:\s+in\s+([\d:]+))?(?:\s+at[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+\/s))?(?:\s+ETA\s+([\d:]+))?/i;

export function parseProgress(
  output: string,
  totalDurationSecondsOrOptions?: number | ParseProgressOptions
): StreamProgressUpdate | null {
  const options: ParseProgressOptions =
    typeof totalDurationSecondsOrOptions === 'number'
      ? { totalDurationSeconds: totalDurationSecondsOrOptions }
      : totalDurationSecondsOrOptions || {};

  return parseStreamProgress(output, options);
}

export function parseStreamProgress(
  output: string,
  options: ParseProgressOptions = {}
): StreamProgressUpdate | null {
  if (!output || typeof output !== 'string') return null;

  const cleanOutput = stripAnsi(output);
  const lines = cleanOutput
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const { totalDurationSeconds, allowFfmpegWithoutDuration = false } = options;

  // Process newest to oldest to get latest status in this chunk
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // 1. yt-dlp download line
    const ytdlpMatch = line.match(YTDLP_REGEX);
    if (ytdlpMatch) {
      const percent = parseFloat(ytdlpMatch[1]);
      const totalStr = ytdlpMatch[2];
      const totalUnit = ytdlpMatch[3];
      const speedStr = ytdlpMatch[5];
      const speedUnit = ytdlpMatch[6];
      const etaStr = ytdlpMatch[7];

      const totalBytes =
        totalStr && totalUnit
          ? Math.round(parseSizeToBytes(parseFloat(totalStr), totalUnit))
          : null;

      let downloadedBytes: number | null = null;
      if (percent === 100 && totalBytes !== null) {
        downloadedBytes = totalBytes;
      } else if (totalBytes !== null) {
        downloadedBytes = Math.round((totalBytes * percent) / 100);
      }

      let speedBps: number | null = null;
      if (speedStr && speedUnit) {
        const unit = speedUnit.split('/')[0];
        speedBps = Math.round(parseSizeToBytes(parseFloat(speedStr), unit));
      }

      const speed = speedStr && speedUnit ? `${speedStr} ${speedUnit}` : null;
      let etaSeconds: number | null = null;
      let eta: string | null = etaStr || null;

      if (etaStr) {
        etaSeconds = parseETAToSeconds(etaStr);
      } else if (percent === 100) {
        eta = '00:00';
        etaSeconds = 0;
      }

      return {
        percent,
        speed,
        speedBps,
        eta,
        etaSeconds,
        totalBytes,
        downloadedBytes,
        stage: percent === 100 ? 'complete' : 'download',
        rawLine: line,
      };
    }

    // 2. FFmpeg transcoding progress line
    const timeMatch = line.match(/time=\s*(-?[\d:.]+)/i);
    if (timeMatch && /(?:size|Lsize|frame|speed)=/i.test(line)) {
      if (totalDurationSeconds === undefined && !allowFfmpegWithoutDuration) {
        continue;
      }

      const timeStr = timeMatch[1];
      const currentTimeSec = Math.max(0, parseTimeToSeconds(timeStr));

      let percent = 0;
      if (totalDurationSeconds && totalDurationSeconds > 0) {
        percent = Math.min(100, Math.max(0, (currentTimeSec / totalDurationSeconds) * 100));
        percent = Math.round(percent * 10) / 10;
      }

      // Parse size / Lsize
      const sizeMatch = line.match(/(?:size|Lsize)=\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)/i);
      let downloadedBytes: number | null = null;
      let totalBytes: number | null = null;
      if (sizeMatch) {
        const sizeVal = parseFloat(sizeMatch[1]);
        const sizeUnit = sizeMatch[2];
        downloadedBytes = parseSizeToBytes(sizeVal, sizeUnit);
        if (
          totalDurationSeconds &&
          totalDurationSeconds > 0 &&
          currentTimeSec > 0 &&
          downloadedBytes > 0
        ) {
          totalBytes = Math.max(
            downloadedBytes,
            Math.round((downloadedBytes / currentTimeSec) * totalDurationSeconds)
          );
        }
      }

      // Parse speed & multiplier
      const speedMatch = line.match(/speed=\s*([\d.]+(?:x|X)?|N\/A)/i);
      let speed: string | null = null;
      let speedMultiplier: number | null = null;
      if (speedMatch && speedMatch[1].toUpperCase() !== 'N/A') {
        const rawSpeed = speedMatch[1];
        speedMultiplier = parseFloat(rawSpeed);
        speed = rawSpeed.toLowerCase().endsWith('x') ? rawSpeed.toLowerCase() : `${rawSpeed}x`;
      }

      // Parse bitrate
      const bitrateMatch = line.match(/bitrate=\s*(\d+(?:\.\d+)?)\s*([A-Za-z/]+)/i);
      let speedBps: number | null = null;
      let bitrate: string | null = null;
      if (bitrateMatch) {
        const val = parseFloat(bitrateMatch[1]);
        const unit = bitrateMatch[2].toLowerCase();
        bitrate = `${bitrateMatch[1]} ${bitrateMatch[2]}`;
        if (unit.startsWith('k')) {
          speedBps = Math.round((val * 1000) / 8);
        } else if (unit.startsWith('m')) {
          speedBps = Math.round((val * 1000000) / 8);
        } else if (unit.startsWith('b')) {
          speedBps = Math.round(val / 8);
        }
      }

      if (!speed && bitrateMatch) {
        speed = `${bitrateMatch[1]} ${bitrateMatch[2]}`;
      }

      // Frame and FPS
      const frameMatch = line.match(/frame=\s*(\d+)/i);
      const frame = frameMatch ? parseInt(frameMatch[1], 10) : null;

      const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/i);
      const fps = fpsMatch ? parseFloat(fpsMatch[1]) : null;

      // ETA calculation
      let eta: string | null = null;
      let etaSeconds: number | null = null;
      if (totalDurationSeconds && totalDurationSeconds > 0) {
        const remainingSec = Math.max(0, totalDurationSeconds - currentTimeSec);
        if (remainingSec === 0) {
          etaSeconds = 0;
          eta = '00:00';
        } else if (speedMultiplier && speedMultiplier > 0) {
          etaSeconds = Math.round(remainingSec / speedMultiplier);
          eta = formatSecondsToETA(etaSeconds);
        } else if (currentTimeSec > 0) {
          etaSeconds = Math.round(remainingSec);
          eta = formatSecondsToETA(etaSeconds);
        }
      }

      return {
        percent,
        speed,
        speedBps,
        eta,
        etaSeconds,
        totalBytes,
        downloadedBytes,
        stage: 'transcode',
        frame,
        fps,
        bitrate,
        speedMultiplier,
        rawLine: line,
      };
    }
  }

  return null;
}

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const isNegative = timeStr.startsWith('-');
  const cleanStr = isNegative ? timeStr.slice(1) : timeStr;
  const parts = cleanStr.split(':').map(Number);
  if (parts.some((p) => Number.isNaN(p))) return 0;
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    seconds = parts[0] || 0;
  }
  if (Number.isNaN(seconds)) return 0;
  return isNegative ? -seconds : seconds;
}

export function formatSecondsToETA(seconds: number): string {
  if (seconds < 0 || Number.isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseETAToSeconds(eta: string): number {
  if (!eta || typeof eta !== 'string') return 0;
  const parts = eta.split(':').map(Number);
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

export function parseSizeToBytes(value: number, unit: string): number {
  if (Number.isNaN(value) || !unit) return value || 0;
  const normalized = unit.trim();
  const units: Record<string, number> = {
    B: 1,
    b: 1,
    KiB: 1024,
    kib: 1024,
    KIB: 1024,
    MiB: 1024 ** 2,
    mib: 1024 ** 2,
    MIB: 1024 ** 2,
    GiB: 1024 ** 3,
    gib: 1024 ** 3,
    GIB: 1024 ** 3,
    TiB: 1024 ** 4,
    tib: 1024 ** 4,
    TIB: 1024 ** 4,
    PiB: 1024 ** 5,
    pib: 1024 ** 5,
    PIB: 1024 ** 5,
    KB: 1000,
    kB: 1000,
    kb: 1000,
    MB: 1000 ** 2,
    mb: 1000 ** 2,
    GB: 1000 ** 3,
    gb: 1000 ** 3,
    TB: 1000 ** 4,
    tb: 1000 ** 4,
    PB: 1000 ** 5,
    pb: 1000 ** 5,
  };
  return Math.round(value * (units[normalized] || units[normalized.toUpperCase()] || 1));
}
