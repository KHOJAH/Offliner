// src/worker/progress-parser.ts

export interface ProgressUpdate {
  percent: number;
  speed: string | null;
  speedBps: number | null;
  eta: string | null;
  etaSeconds: number | null;
  totalBytes: number | null;
  downloadedBytes: number | null;
}

export function parseProgress(output: string, totalDurationSeconds?: number): ProgressUpdate | null {
  if (!output || typeof output !== 'string') return null;

  // Split on newlines and carriage returns (FFmpeg uses \r for inline progress updates)
  const lines = output.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  // Process from newest line to oldest to get the latest progress update in this chunk
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // 1. Try matching yt-dlp native progress format:
    // [download]  45.2% of ~  5.32MiB at    1.23MiB/s ETA 03:15
    // [download] 100% of  123.45MiB in 00:45
    // [download]  75.0%
    const ytdlpMatch = line.match(
      /\[download\]\s+(\d+(?:\.\d+)?)%(?:\s+of[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+))?(?:\s+at[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+\/s))?(?:\s+ETA\s+([\d:]+))?/
    );

    if (ytdlpMatch) {
      const percent = parseFloat(ytdlpMatch[1]);
      const totalStr = ytdlpMatch[2];
      const totalUnit = ytdlpMatch[3];
      const speedStr = ytdlpMatch[4];
      const speedUnit = ytdlpMatch[5];
      const etaStr = ytdlpMatch[6];

      const totalBytes = totalStr && totalUnit ? parseSizeToBytes(parseFloat(totalStr), totalUnit) : null;
      const downloadedBytes = totalBytes ? (totalBytes * percent) / 100 : null;

      let speedBps = null;
      if (speedStr && speedUnit) {
        const unit = speedUnit.split('/')[0];
        speedBps = parseSizeToBytes(parseFloat(speedStr), unit);
      }
      const speed = speedStr && speedUnit ? `${speedStr} ${speedUnit}` : null;
      const etaSeconds = etaStr ? parseETAToSeconds(etaStr) : null;

      return {
        percent,
        speed,
        speedBps,
        eta: etaStr || null,
        etaSeconds,
        totalBytes,
        downloadedBytes,
      };
    }

    // 2. Try matching FFmpeg progress format:
    // frame=  203 fps=0.0 q=29.0 size=     512KiB time=00:00:06.74 bitrate= 622.4kbits/s speed=12.8x elapsed=0:00:00.52
    // size=   1024kB time=00:00:15.50 bitrate= 541.2kbits/s speed=2.45x
    const timeMatch = line.match(/time=\s*(-?[\d:.]+)/i);
    if (timeMatch && (/(?:size|Lsize|frame|speed)=/i.test(line))) {
      // If totalDurationSeconds is undefined, do not treat FFmpeg line as a download progress event,
      // because without duration context (e.g. during remuxing/merging of full videos) it would reset
      // download progress to 0% and wipe byte counters.
      if (totalDurationSeconds === undefined) {
        continue;
      }

      const timeStr = timeMatch[1];
      const currentTimeSec = Math.max(0, parseTimeToSeconds(timeStr));

      // Estimate percent based on totalDurationSeconds (e.g. clip duration)
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
        if (totalDurationSeconds && totalDurationSeconds > 0 && currentTimeSec > 0 && downloadedBytes > 0) {
          totalBytes = Math.max(downloadedBytes, Math.round((downloadedBytes / currentTimeSec) * totalDurationSeconds));
        }
      }

      // Parse speed
      const speedMatch = line.match(/speed=\s*([\d.]+(?:x|X)?|N\/A)/i);
      let speed: string | null = null;
      let speedMultiplier: number | null = null;
      if (speedMatch && speedMatch[1].toUpperCase() !== 'N/A') {
        const rawSpeed = speedMatch[1];
        speedMultiplier = parseFloat(rawSpeed);
        speed = rawSpeed.toLowerCase().endsWith('x') ? rawSpeed.toLowerCase() : `${rawSpeed}x`;
      }

      // Parse bitrate for speedBps
      const bitrateMatch = line.match(/bitrate=\s*(\d+(?:\.\d+)?)\s*([A-Za-z/]+)/i);
      let speedBps: number | null = null;
      if (bitrateMatch) {
        const val = parseFloat(bitrateMatch[1]);
        const unit = bitrateMatch[2].toLowerCase();
        if (unit.startsWith('k')) {
          speedBps = Math.round((val * 1000) / 8);
        } else if (unit.startsWith('m')) {
          speedBps = Math.round((val * 1000000) / 8);
        } else if (unit.startsWith('b')) {
          speedBps = Math.round(val / 8);
        }
      }

      // If speed multiplier was N/A or missing, but bitrate exists, format speed from bitrate
      if (!speed && bitrateMatch) {
        speed = `${bitrateMatch[1]} ${bitrateMatch[2]}`;
      }

      // Calculate ETA
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
      };
    }
  }

  return null;
}

function parseTimeToSeconds(timeStr: string): number {
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

function formatSecondsToETA(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseETAToSeconds(eta: string): number {
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
  const normalized = unit.trim();
  const units: Record<string, number> = {
    B: 1,
    b: 1,
    KiB: 1024,
    kib: 1024,
    MiB: 1024 ** 2,
    mib: 1024 ** 2,
    GiB: 1024 ** 3,
    gib: 1024 ** 3,
    KB: 1000,
    kB: 1000,
    kb: 1000,
    MB: 1000 ** 2,
    mb: 1000 ** 2,
    GB: 1000 ** 3,
    gb: 1000 ** 3,
  };
  return value * (units[normalized] || units[normalized.toUpperCase()] || 1);
}
