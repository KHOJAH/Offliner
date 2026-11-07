// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildDownloadArgs,
  buildMetadataArgs,
  type DownloadOptions,
  type ClipRange,
} from '@/engine/ytdlp/builder';
import {
  parseProgress,
  parseStreamProgress,
  stripAnsi,
  parseSizeToBytes,
} from '@/engine/parser/progress';
import {
  DestinationTracker,
  parseDestinationLine,
  extractDestinationPath,
} from '@/engine/parser/destination';
import {
  parseError,
  type ErrorCategory,
} from '@/engine/parser/error';

const VALID_CATEGORIES: ErrorCategory[] = [
  'network',
  'video_unavailable',
  'private_video',
  'age_restricted',
  'format_unavailable',
  'geo_restricted',
  'disk_space',
  'permission_denied',
  'tool_missing',
  'unknown',
];

describe('Empirical Stress Harness: Engine Parsers & Builders', () => {
  describe('Suite 1: High-Throughput Progress Parser Fuzzing', () => {
    it('1.1 parses 10,000 randomized and corrupted chunks without throwing or leaking', () => {
      const start = performance.now();
      const corruptedSnippets = [
        '\x1b[0;32m[download]\x1b[0m 99.9% of ~ 1.5GiB at 25.4MiB/s ETA 00:01',
        '[download]   0.0% of  500.00MiB at Unknown speed ETA Unknown',
        '[download] 100% of 10.00MiB in 00:05',
        'frame= 1234 fps= 59.9 q=24.0 size= 51200kB time=00:08:24.12 bitrate= 832.1kbits/s speed= 3.4x',
        '\x1b[2K\r[download]  45.0% (frag 10/20) at 1.20MiB/s ETA 00:10',
        'random junk text with [download] inside but no percent',
        '[download] % of ~ at ETA',
        '',
        '\n\r\n\r',
        '\x00\x01\x02\x03\x04\x05\x06\x07\x08',
        '❤️ 🎬 🚀 日本語 العربية \u200B\uFEFF',
        'time=--:--:-- size=NaN speed=Infinity',
        'ERROR: something went wrong',
      ];

      for (let i = 0; i < 10000; i++) {
        const snippet = corruptedSnippets[i % corruptedSnippets.length];
        const mutated = i % 3 === 0 ? snippet.slice(0, i % 20) : snippet;
        expect(() => parseStreamProgress(mutated, { totalDurationSeconds: 600 })).not.toThrow();
      }

      const elapsed = performance.now() - start;
      // 10,000 iterations must complete within 1.5 seconds
      expect(elapsed).toBeLessThan(1500);
    });

    it('1.2 stress-tests 50 concurrent independent DestinationTrackers under interleaved stream chunks', () => {
      const trackers = Array.from({ length: 50 }, () => new DestinationTracker());
      const filenames = Array.from({ length: 50 }, (_, i) => `/downloads/video_${i}.mp4`);

      // Interleave stream chunks across all 50 trackers
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 50; i++) {
          const tracker = trackers[i];
          const file = filenames[i];
          tracker.reset();

          tracker.update(`[download] Destination: ${file}.f137.mp4`);
          expect(tracker.getPath()).toBe(`${file}.f137.mp4`);

          tracker.update(`[download] Destination: ${file}.f140.m4a`);
          expect(tracker.getPath()).toBe(`${file}.f140.m4a`);

          tracker.update(`[Merger] Merging formats into "${file}"`);
          expect(tracker.getPath()).toBe(file);

          // Once final, intermediate lines must not corrupt final path
          tracker.update(`[download] Destination: ${file}.f137.mp4`);
          expect(tracker.getPath()).toBe(file);
        }
      }
    });
  });

  describe('Suite 2: High-Volume CLI Argument Builder Stress', () => {
    it('2.1 executes 5,000 buildDownloadArgs calls with randomized options combinations', () => {
      const start = performance.now();
      const urls = [
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://vimeo.com/12345678',
        'https://soundcloud.com/artist/track',
      ];
      const modes: Array<'video' | 'audio' | 'clip' | 'playlist'> = ['video', 'audio', 'clip', 'playlist'];
      const audioFormats = ['mp3', 'm4a', 'flac', 'opus', 'wav'];

      for (let i = 0; i < 5000; i++) {
        const url = urls[i % urls.length];
        const mode = modes[i % modes.length];
        const isAudio = mode === 'audio';
        const clips: ClipRange[] | undefined =
          mode === 'clip' ? [{ start: (i * 5) % 100, end: ((i * 5) % 100) + 10 }] : undefined;

        const options: DownloadOptions = {
          url,
          mode,
          outputPath: i % 2 === 0 ? '/downloads' : '/downloads/file.mp4',
          extractAudio: isAudio,
          audioFormat: isAudio ? audioFormats[i % audioFormats.length] : undefined,
          audioQuality: isAudio ? (i % 10) : undefined,
          clips,
          continueDownload: i % 2 === 0,
        };

        const args = buildDownloadArgs(options);
        expect(args[args.length - 1]).toBe(url);
        expect(args).toContain('--newline');
        expect(args).toContain('--force-overwrites');
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('Suite 3: Error Classifier Fuzzing', () => {
    it('3.1 classifies 2,000 generated stderr patterns and guarantees taxonomy conformance', () => {
      const errorPrefixes = [
        'ERROR: [youtube]',
        'WARNING: [youtube]',
        'yt-dlp error:',
        'ffmpeg:',
        'Traceback (most recent call last):',
      ];
      const errorBodies = [
        'Video unavailable',
        'Sign in to confirm your age',
        'Sign in to confirm you’re not a bot',
        'urlopen error timed out',
        'Connection reset by peer',
        'No space left on device',
        'Permission denied',
        'ffmpeg not found',
        'The uploader has not made this video available in your country',
        'Requested format is not available',
        'completely bizarre and unparseable custom failure code 0x80070057',
      ];

      for (let i = 0; i < 2000; i++) {
        const prefix = errorPrefixes[i % errorPrefixes.length];
        const body = errorBodies[i % errorBodies.length];
        const raw = `${prefix} ${body} (iteration ${i})`;

        const parsed = parseError(raw, (i % 2) + 1);
        expect(VALID_CATEGORIES).toContain(parsed.category);
        expect(typeof parsed.isTransient).toBe('boolean');
        expect(typeof parsed.userMessage).toBe('string');
        expect(parsed.userMessage.length).toBeGreaterThan(0);
        expect(parsed.rawMessage).toBe(raw);
      }
    });
  });
});
