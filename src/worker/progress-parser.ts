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

export function parseProgress(output: string): ProgressUpdate | null {
  // Match yt-dlp progress format:
  // [download]  45.2% of ~  5.32MiB at    1.23MiB/s ETA 03:15
  // [download] 100% of  123.45MiB in 00:45
  const match = output.match(
    /\[download\]\s+(\d+(?:\.\d+)?)%(?:\s+of[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+))?(?:\s+at[~\s]+(\d+(?:\.\d+)?)\s*([A-Za-z]+\/s))?(?:\s+ETA\s+([\d:]+))?/
  );

  if (!match) return null;

  const percent = parseFloat(match[1]);
  const totalStr = match[2];
  const totalUnit = match[3];
  const speedStr = match[4];
  const speedUnit = match[5];
  const etaStr = match[6];

  const totalBytes = totalStr && totalUnit ? parseSizeToBytes(parseFloat(totalStr), totalUnit) : null;
  const downloadedBytes = totalBytes ? (totalBytes * percent) / 100 : null;
  
  let speedBps = null;
  if (speedStr && speedUnit) {
    // speedUnit is like "MiB/s"
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

function parseETAToSeconds(eta: string): number {
  const parts = eta.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

export function parseSizeToBytes(value: number, unit: string): number {
  const units: Record<string, number> = {
    B: 1,
    KiB: 1024,
    MiB: 1024 ** 2,
    GiB: 1024 ** 3,
    KB: 1000,
    MB: 1000 ** 2,
    GB: 1000 ** 3,
  };
  return value * (units[unit] || 1);
}
