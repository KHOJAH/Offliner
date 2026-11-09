/**
 * tests/unit/progress.test.ts
 * Comprehensive unit test suite for stream progress, destination extraction,
 * error classification, and metrics utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  parseProgress,
  parseStreamProgress,
  stripAnsi,
  parseSizeToBytes,
  parseTimeToSeconds,
  formatSecondsToETA,
  parseETAToSeconds,
} from '@/engine/parser/progress';
import {
  parseDestinationLine,
  extractDestinationPath,
  DestinationTracker,
} from '@/engine/parser/destination';
import {
  parseError,
  isTransientError,
  extractVideoId,
} from '@/engine/parser/error';

describe('Unified Stream Progress & Error Parser', () => {
  // SUITE 1: yt-dlp Download Progress Parsing
  describe('Suite 1: yt-dlp Download Progress Parsing', () => {
    it('1.1 parses standard full download progress line', () => {
      const line = '[download]  45.2% of ~  5.32MiB at    1.23MiB/s ETA 03:15';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(45.2);
      expect(result!.speed).toBe('1.23 MiB/s');
      expect(result!.speedBps).toBe(Math.round(1.23 * 1024 * 1024));
      expect(result!.eta).toBe('03:15');
      expect(result!.etaSeconds).toBe(195);
      expect(result!.totalBytes).toBe(Math.round(5.32 * 1024 * 1024));
      expect(result!.downloadedBytes).toBe(
        Math.round((Math.round(5.32 * 1024 * 1024) * 45.2) / 100)
      );
      expect(result!.stage).toBe('download');
    });

    it('1.2 parses percentage-only line', () => {
      const line = '[download]  75.0%';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(75.0);
      expect(result!.speed).toBeNull();
      expect(result!.speedBps).toBeNull();
      expect(result!.eta).toBeNull();
      expect(result!.etaSeconds).toBeNull();
    });

    it('1.3 parses completion line with elapsed time', () => {
      const line = '[download] 100% of  123.45MiB in 00:45';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(100);
      expect(result!.totalBytes).toBe(Math.round(123.45 * 1024 * 1024));
      expect(result!.downloadedBytes).toBe(Math.round(123.45 * 1024 * 1024));
      expect(result!.eta).toBe('00:00');
      expect(result!.etaSeconds).toBe(0);
      expect(result!.stage).toBe('complete');
    });

    it('1.4 parses completion line with speed', () => {
      const line = '[download] 100% of 10.00MiB in 00:05 at 2.00MiB/s';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(100);
      expect(result!.speed).toBe('2.00 MiB/s');
      expect(result!.downloadedBytes).toBe(10 * 1024 * 1024);
      expect(result!.stage).toBe('complete');
    });

    it('1.5 parses long duration ETA with hours', () => {
      const line = '[download]  10.0% of ~ 100.00GiB at 10.00MiB/s ETA 02:46:40';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.eta).toBe('02:46:40');
      expect(result!.etaSeconds).toBe(2 * 3600 + 46 * 60 + 40);
      expect(result!.totalBytes).toBe(100 * 1024 * 1024 * 1024);
    });

    it('1.6 parses fragmented stream line with (frag X/Y) correctly (frag fix)', () => {
      const line = '[download]  12.5% of ~ 100.00MiB (frag 5/40) at 1.50MiB/s ETA 00:30';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(12.5);
      expect(result!.speed).toBe('1.50 MiB/s');
      expect(result!.eta).toBe('00:30');
      expect(result!.etaSeconds).toBe(30);
    });

    it('1.7 strips ANSI escape sequences before parsing', () => {
      const line = '\x1b[0;32m[download]\x1b[0m  50.0% of ~  20.00MiB at  2.00MiB/s ETA 00:05';
      const result = parseProgress(line);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(50.0);
      expect(result!.speed).toBe('2.00 MiB/s');
      expect(result!.eta).toBe('00:05');
    });

    it('1.8 returns null for non-progress lines', () => {
      const line = '[info] dQw4w9WgXcQ: Downloading webpage';
      expect(parseProgress(line)).toBeNull();
    });
  });

  // SUITE 2: FFmpeg Transcoding Progress Parsing
  describe('Suite 2: FFmpeg Transcoding Progress Parsing', () => {
    it('2.1 parses full transcoding line with clip duration', () => {
      const line =
        'frame=  203 fps=0.0 q=29.0 size=     512KiB time=00:00:06.74 bitrate= 622.4kbits/s speed=12.8x elapsed=0:00:00.52';
      const result = parseProgress(line, 10);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(67.4);
      expect(result!.speed).toBe('12.8x');
      expect(result!.frame).toBe(203);
      expect(result!.bitrate).toBe('622.4 kbits/s');
      expect(result!.downloadedBytes).toBe(512 * 1024);
      expect(result!.stage).toBe('transcode');
    });

    it('2.2 parses transcoding completion line with Lsize', () => {
      const line =
        'frame=  270 fps=0.0 q=-1.0 Lsize=     757KiB time=00:00:08.97 bitrate= 690.7kbits/s speed=14.1x';
      const result = parseProgress(line, 9);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(99.7);
      expect(result!.speed).toBe('14.1x');
      expect(result!.downloadedBytes).toBe(757 * 1024);
      expect(result!.stage).toBe('transcode');
    });

    it('2.3 parses audio transcoding line without frame count (bitrate fallback)', () => {
      const line = 'size=    256kB time=00:00:03.00 bitrate= 652.8kbits/s speed=N/A';
      const result = parseProgress(line, 10);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(30.0);
      expect(result!.speed).toBe('652.8 kbits/s');
      expect(result!.downloadedBytes).toBe(256 * 1000);
    });

    it('2.4 parses latest progress from carriage-return separated multi-line chunk', () => {
      const chunk =
        'frame= 100 size= 200KiB time=00:00:03.00 speed=10.0x\rframe= 200 size= 400KiB time=00:00:06.00 speed=12.0x\r';
      const result = parseProgress(chunk, 10);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(60.0);
      expect(result!.speed).toBe('12.0x');
      expect(result!.downloadedBytes).toBe(400 * 1024);
    });

    it('2.5 handles zero clip duration gracefully without divide-by-zero', () => {
      const line = 'size= 100KiB time=00:00:05.00 speed=2.0x';
      const result = parseProgress(line, 0);
      expect(result).not.toBeNull();
      expect(result!.percent).toBe(0);
      expect(Number.isNaN(result!.percent)).toBe(false);
    });

    it('2.6 ignores FFmpeg lines when duration is undefined to protect full video downloads', () => {
      const line =
        'frame= 100 size= 1024KiB time=00:00:05.00 speed=10.0x bitrate= 600.0kbits/s';
      expect(parseProgress(line)).toBeNull();
    });

    it('2.7 allows FFmpeg lines without duration when allowFfmpegWithoutDuration option is true', () => {
      const line =
        'frame= 100 size= 1024KiB time=00:00:05.00 speed=10.0x bitrate= 600.0kbits/s';
      const result = parseStreamProgress(line, { allowFfmpegWithoutDuration: true });
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('transcode');
      expect(result!.frame).toBe(100);
      expect(result!.speed).toBe('10.0x');
      expect(result!.percent).toBe(0);
    });
  });

  // SUITE 3: Destination File Path Extraction
  describe('Suite 3: Destination File Path Extraction', () => {
    it('3.1 parses standard download destination', () => {
      const info = parseDestinationLine('[download] Destination: /downloads/video.mp4');
      expect(info).not.toBeNull();
      expect(info!.filePath).toBe('/downloads/video.mp4');
      expect(info!.operation).toBe('download');
      expect(info!.isFinal).toBe(false);
    });

    it('3.2 parses quoted Windows destination path cleanly', () => {
      const info = parseDestinationLine(
        '[download] Destination: "C:\\Users\\User\\Downloads\\video.mp4"'
      );
      expect(info).not.toBeNull();
      expect(info!.filePath).toBe('C:\\Users\\User\\Downloads\\video.mp4');
    });

    it('3.3 parses already downloaded line', () => {
      const info = parseDestinationLine(
        '[download] /path/to/existing.mp4 has already been downloaded'
      );
      expect(info).not.toBeNull();
      expect(info!.filePath).toBe('/path/to/existing.mp4');
      expect(info!.operation).toBe('already_downloaded');
      expect(info!.isFinal).toBe(true);
    });

    it('3.4 resolves merger output over intermediate DASH streams', () => {
      const chunk = `
[download] Destination: /downloads/video.f137.mp4
[download] Destination: /downloads/video.f140.m4a
[Merger] Merging formats into "/downloads/video.mp4"
      `;
      const finalDest = extractDestinationPath(chunk);
      expect(finalDest).toBe('/downloads/video.mp4');
    });

    it('3.5 parses audio extraction destination', () => {
      const info = parseDestinationLine('[ExtractAudio] Destination: /downloads/track.mp3');
      expect(info).not.toBeNull();
      expect(info!.filePath).toBe('/downloads/track.mp3');
      expect(info!.operation).toBe('extract_audio');
      expect(info!.isFinal).toBe(true);
    });

    it('3.6 DestinationTracker tracks streaming output updates accurately', () => {
      const tracker = new DestinationTracker();
      expect(tracker.getPath()).toBeNull();

      tracker.update('[download] Destination: /downloads/video.f137.mp4');
      expect(tracker.getPath()).toBe('/downloads/video.f137.mp4');

      tracker.update('[Merger] Merging formats into "/downloads/video.mp4"');
      expect(tracker.getPath()).toBe('/downloads/video.mp4');

      tracker.reset();
      expect(tracker.getPath()).toBeNull();
    });
  });

  // SUITE 4: Error Classification
  describe('Suite 4: Error Classification', () => {
    it('4.1 classifies urlopen timeout as transient network error with videoId', () => {
      const stderr =
        'ERROR: [youtube] dQw4w9WgXcQ: Unable to download webpage: <urlopen error timed out>';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('network');
      expect(parsed.isTransient).toBe(true);
      expect(parsed.videoId).toBe('dQw4w9WgXcQ');
      expect(isTransientError(stderr)).toBe(true);
    });

    it('4.2 classifies connection reset as transient network error', () => {
      const stderr = 'ERROR: [download] Got error: Connection reset by peer';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('network');
      expect(parsed.isTransient).toBe(true);
    });

    it('4.3 classifies private video as permanent private_video error', () => {
      const stderr =
        'ERROR: [youtube] dQw4w9WgXcQ: Private video. Sign in if you\'ve been granted access';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('private_video');
      expect(parsed.isTransient).toBe(false);
      expect(parsed.videoId).toBe('dQw4w9WgXcQ');
    });

    it('4.4 classifies age-restricted video as permanent age_restricted error', () => {
      const stderr =
        'ERROR: [youtube] 12345678901: Sign in to confirm your age. This video may be inappropriate';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('age_restricted');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.5 classifies unavailable/removed video as permanent video_unavailable error', () => {
      const stderr =
        'ERROR: [youtube] xyz12345678: Video unavailable. This video has been removed by the uploader';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('video_unavailable');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.6 classifies missing format as permanent format_unavailable error', () => {
      const stderr =
        'ERROR: [youtube] abc12345678: Requested format is not available. Use --list-formats';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('format_unavailable');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.7 classifies country copyright block as permanent geo_restricted error', () => {
      const stderr =
        'ERROR: [youtube] abc12345678: The uploader has not made this video available in your country';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('geo_restricted');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.8 classifies disk space Errno 28 as permanent disk_space error', () => {
      const stderr = 'ERROR: [download] Destination: /out.mp4: [Errno 28] No space left on device';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('disk_space');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.9 classifies missing FFmpeg as permanent tool_missing error', () => {
      const stderr = 'ERROR: Postprocessing: ffmpeg not found. Please install or provide path';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('tool_missing');
      expect(parsed.isTransient).toBe(false);
    });

    it('4.10 classifies generic unknown error cleanly', () => {
      const stderr = 'ERROR: Something completely unexpected happened';
      const parsed = parseError(stderr);
      expect(parsed.category).toBe('unknown');
      expect(parsed.isTransient).toBe(false);
      expect(parsed.userMessage).toBe('Something completely unexpected happened');
    });
  });

  // SUITE 5: Size & Time Utilities
  describe('Suite 5: Size & Time Utilities', () => {
    it('5.1 verifies parseSizeToBytes conversion accuracy', () => {
      expect(parseSizeToBytes(1, 'B')).toBe(1);
      expect(parseSizeToBytes(1, 'KiB')).toBe(1024);
      expect(parseSizeToBytes(1, 'MiB')).toBe(1024 * 1024);
      expect(parseSizeToBytes(1, 'GiB')).toBe(1024 * 1024 * 1024);
      expect(parseSizeToBytes(1, 'KB')).toBe(1000);
      expect(parseSizeToBytes(1, 'MB')).toBe(1000 * 1000);
      expect(parseSizeToBytes(1, 'GB')).toBe(1000 * 1000 * 1000);
      expect(parseSizeToBytes(10, 'UNKNOWN')).toBe(10);
    });

    it('5.2 verifies parseTimeToSeconds format parsing', () => {
      expect(parseTimeToSeconds('01:02:03.45')).toBe(3723.45);
      expect(parseTimeToSeconds('05:30')).toBe(330);
      expect(parseTimeToSeconds('45')).toBe(45);
      expect(parseTimeToSeconds('-00:01:00')).toBe(-60);
      expect(parseTimeToSeconds('invalid')).toBe(0);
    });

    it('5.3 verifies formatSecondsToETA formatting', () => {
      expect(formatSecondsToETA(0)).toBe('00:00');
      expect(formatSecondsToETA(45)).toBe('00:45');
      expect(formatSecondsToETA(195)).toBe('03:15');
      expect(formatSecondsToETA(3665)).toBe('01:01:05');
      expect(formatSecondsToETA(-10)).toBe('00:00');
    });

    it('5.4 verifies parseETAToSeconds formatting', () => {
      expect(parseETAToSeconds('00:30')).toBe(30);
      expect(parseETAToSeconds('02:15')).toBe(135);
      expect(parseETAToSeconds('01:02:03')).toBe(3723);
      expect(parseETAToSeconds('')).toBe(0);
    });
  });
});
