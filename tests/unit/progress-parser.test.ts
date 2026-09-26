// tests/unit/progress-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseProgress, parseSizeToBytes } from '@/worker/progress-parser';

describe('parseProgress', () => {
  it('parses full progress line', () => {
    const line = '[download]  45.2% of ~  5.32MiB at    1.23MiB/s ETA 03:15';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(45.2);
    expect(result!.speed).toBe('1.23 MiB/s');
    expect(result!.eta).toBe('03:15');
  });

  it('parses percentage only', () => {
    const line = '[download]  75.0%';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(75.0);
    expect(result!.speed).toBeNull();
  });

  it('parses completion line', () => {
    const line = '[download] 100% of  123.45MiB in 00:45';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(100);
  });

  it('returns null for non-progress lines', () => {
    const line = '[info] Video title here';
    expect(parseProgress(line)).toBeNull();
  });

  it('handles zero percent', () => {
    const line = '[download]   0.0% of ~  10.00MiB at    2.00MiB/s ETA 00:05';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });

  it('parses FFmpeg progress line and estimates percent from clip duration', () => {
    const line = 'frame=  203 fps=0.0 q=29.0 size=     512KiB time=00:00:06.74 bitrate= 622.4kbits/s speed=12.8x elapsed=0:00:00.52';
    // Clip duration is 10 seconds, time is 6.74s -> 67.4%
    const result = parseProgress(line, 10);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(67.4);
    expect(result!.speed).toBe('12.8x');
    expect(result!.downloadedBytes).toBe(512 * 1024);
    expect(result!.eta).toBe('00:00');
    expect(result!.speedBps).toBe(Math.round((622.4 * 1000) / 8));
  });

  it('parses FFmpeg final completion line with Lsize', () => {
    const line = 'frame=  270 fps=0.0 q=-1.0 Lsize=     757KiB time=00:00:08.97 bitrate= 690.7kbits/s speed=14.1x elapsed=0:00:00.63';
    // Clip duration is 9 seconds, time is 8.97s -> 99.7%
    const result = parseProgress(line, 9);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(99.7);
    expect(result!.speed).toBe('14.1x');
    expect(result!.downloadedBytes).toBe(757 * 1024);
  });

  it('handles FFmpeg progress line when speed is N/A', () => {
    const line = 'size=    256kB time=00:00:03.00 bitrate= 652.8kbits/s speed=N/A';
    const result = parseProgress(line, 10);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(30.0);
    // Speed fallback from bitrate
    expect(result!.speed).toBe('652.8 kbits/s');
    expect(result!.downloadedBytes).toBe(256 * 1000);
  });

  it('parses latest progress from multi-line chunk separated by carriage return', () => {
    const chunk = 'frame=  100 fps=0.0 size=  200KiB time=00:00:03.00 speed=10.0x\rframe=  200 fps=0.0 size=  400KiB time=00:00:06.00 speed=12.0x\r';
    const result = parseProgress(chunk, 10);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(60.0);
    expect(result!.speed).toBe('12.0x');
    expect(result!.downloadedBytes).toBe(400 * 1024);
  });

  it('handles zero clip duration gracefully without divide-by-zero', () => {
    const line = 'size=  100KiB time=00:00:05.00 speed=2.0x';
    const result = parseProgress(line, 0);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });

  it('ignores FFmpeg progress lines when totalDurationSeconds is undefined to protect full downloads', () => {
    const line = 'frame=  100 fps=0.0 size=  1024KiB time=00:00:05.00 bitrate= 600.0kbits/s speed=10.0x';
    const result = parseProgress(line);
    expect(result).toBeNull();
  });

  it('caps percent at 100 and ensures totalBytes is not less than downloadedBytes when time exceeds duration', () => {
    const line = 'frame=  300 fps=0.0 size=  1000KiB time=00:00:11.50 speed=1.0x';
    const result = parseProgress(line, 10);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(100);
    expect(result!.downloadedBytes).toBe(1000 * 1024);
    expect(result!.totalBytes).toBeGreaterThanOrEqual(1000 * 1024);
  });

  it('handles malformed or invalid time strings without producing NaN percent', () => {
    const line = 'size=  100KiB time=N/A speed=2.0x';
    const result = parseProgress(line, 10);
    // time=N/A does not match (-?[\d:.]+) so it returns null
    expect(result).toBeNull();
  });
});

describe('parseSizeToBytes', () => {
  it('converts MiB correctly', () => {
    expect(parseSizeToBytes(1, 'MiB')).toBe(1024 * 1024);
  });
  it('converts GiB correctly', () => {
    expect(parseSizeToBytes(1, 'GiB')).toBe(1024 * 1024 * 1024);
  });
  it('converts KB correctly', () => {
    expect(parseSizeToBytes(1, 'KB')).toBe(1000);
  });
  it('returns 1 for unknown unit', () => {
    expect(parseSizeToBytes(5, 'XX')).toBe(5);
  });
});
