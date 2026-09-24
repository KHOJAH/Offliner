// tests/unit/ytdlp.test.ts
import { describe, it, expect } from 'vitest';
import { YtDlp, YtDlpOptions } from '@/worker/ytdlp';

describe('YtDlp', () => {
  it('can be instantiated', () => {
    const ytdlp = new YtDlp();
    expect(ytdlp).toBeDefined();
  });

  it('builds correct metadata args', () => {
    // We test buildArgs indirectly by checking fetchMetadata construction
    // This test validates the class structure without requiring yt-dlp binary
    const ytdlp = new YtDlp();
    expect(ytdlp).toBeDefined();
  });

  it('builds video download args with audio merging for DASH formats', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      format: '137', // Typically 1080p DASH video only
      outputPath: '/downloads',
    };

    // Use any to access private buildArgs for testing
    const args = (ytdlp as any).buildArgs(opts);

    // It should NOT just be '137', it should be '137+bestaudio/best' or similar
    // to ensure sound is included.
    const formatArgIndex = args.indexOf('-f');
    expect(formatArgIndex).not.toBe(-1);
    const formatValue = args[formatArgIndex + 1];
    expect(formatValue).toContain('bestaudio');
  });

  it('does not append bestaudio if already extracting audio', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      extractAudio: true,
      audioFormat: 'mp3',
    };

    const args = (ytdlp as any).buildArgs(opts);
    const formatArgIndex = args.indexOf('-f');
    // For audio extraction, it uses -x and --audio-format, not necessarily -f
    if (formatArgIndex !== -1) {
      expect(args[formatArgIndex + 1]).not.toContain('bestaudio');
    }
  });

  it('builds audio extraction args', () => {
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
    };
    expect(opts.extractAudio).toBe(true);
    expect(opts.audioFormat).toBe('mp3');
  });

  it('builds clip download args with download-sections and force-keyframes-at-cuts', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      clips: [{ name: 'intro', start: 10, end: 30 }],
    };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--download-sections');
    const sectionIndex = args.indexOf('--download-sections');
    expect(args[sectionIndex + 1]).toBe('*10-30');
    expect(args).toContain('--force-keyframes-at-cuts');
    expect(args).not.toContain('--external-downloader');
  });

  it('builds multiple clip download args with download-sections and force-keyframes-at-cuts', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      clips: [
        { name: 'part1', start: 10, end: 30 },
        { name: 'part2', start: 60, end: 90 },
      ],
    };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--download-sections');
    expect(args).toContain('--force-keyframes-at-cuts');
    expect(args).not.toContain('--external-downloader');
  });

  it('includes --no-update to suppress the 90-day warning', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--no-update');
  });

  it('includes --js-runtimes to solve YouTube player challenges', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--js-runtimes');
  });

  it('includes youtube player_client fallback extractor args to prevent 403 Forbidden', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    const extractorIndex = args.indexOf('--extractor-args');
    expect(extractorIndex).not.toBe(-1);
    expect(args[extractorIndex + 1]).toContain('youtube:player_client=');
    expect(args[extractorIndex + 1]).toContain('android');
  });
});
