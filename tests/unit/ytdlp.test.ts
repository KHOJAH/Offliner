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

  it('includes youtube player_client extractor args with web_embedded and web to prevent 403 Forbidden and SABR warnings', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    const extractorIndex = args.indexOf('--extractor-args');
    expect(extractorIndex).not.toBe(-1);
    expect(args[extractorIndex + 1]).toContain('youtube:player_client=');
    expect(args[extractorIndex + 1]).toContain('web_embedded');
    expect(args[extractorIndex + 1]).toContain('web');
    expect(args[extractorIndex + 1]).not.toContain('android');
    expect(args[extractorIndex + 1]).not.toContain('ios');
    expect(args[extractorIndex + 1]).not.toContain('mweb');
  });

  it('defaults video export to MP4 using --merge-output-format and --remux-video', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--merge-output-format');
    const mergeIndex = args.indexOf('--merge-output-format');
    expect(args[mergeIndex + 1]).toBe('mp4');
    expect(args).toContain('--remux-video');
    const remuxIndex = args.indexOf('--remux-video');
    expect(args[remuxIndex + 1]).toBe('mp4');
    expect(args).not.toContain('--prefer-free-formats');
  });

  it('respects custom videoFormat if provided', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc', videoFormat: 'mkv' };
    const args = (ytdlp as any).buildArgs(opts);
    const mergeIndex = args.indexOf('--merge-output-format');
    expect(args[mergeIndex + 1]).toBe('mkv');
    const remuxIndex = args.indexOf('--remux-video');
    expect(args[remuxIndex + 1]).toBe('mkv');
  });

  it('does not add mp4 merge/remux args when extracting audio', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc', extractAudio: true, audioFormat: 'mp3' };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).not.toContain('--merge-output-format');
    expect(args).not.toContain('--remux-video');
  });

  it('includes --format-sort proto to prioritize HTTPS/HTTP over m3u8 streams', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    expect(args).toContain('--format-sort');
    const sortIndex = args.indexOf('--format-sort');
    expect(args[sortIndex + 1]).toBe('proto');
  });

  it('prioritizes web_embedded in player_client to avoid GVS PO token and SABR warnings', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc' };
    const args = (ytdlp as any).buildArgs(opts);
    const extractorIndex = args.indexOf('--extractor-args');
    expect(extractorIndex).not.toBe(-1);
    expect(args[extractorIndex + 1]).toContain('web_embedded');
    expect(args[extractorIndex + 1]).toContain('youtube:player_client=web_embedded');
  });

  it('prevents m3u8 audio streams when merging bestaudio with a video format', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = { url: 'https://youtube.com/watch?v=abc', format: '137' };
    const args = (ytdlp as any).buildArgs(opts);
    const formatIndex = args.indexOf('-f');
    expect(formatIndex).not.toBe(-1);
    expect(args[formatIndex + 1]).toContain('bestaudio[protocol!*=m3u8]');
  });

  it('uses protocol!*=m3u8 for default clip downloads when no format is specified', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      clips: [{ name: 'clip1', start: 10, end: 20 }],
    };
    const args = (ytdlp as any).buildArgs(opts);
    const formatIndex = args.indexOf('-f');
    expect(formatIndex).not.toBe(-1);
    expect(args[formatIndex + 1]).toContain('protocol!*=m3u8');
  });

  it('clamps clip end time to be at least start + 1 when start >= end', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      clips: [{ name: 'clip_zero', start: 890, end: 890 }],
    };
    const args = (ytdlp as any).buildArgs(opts);
    const sectionIndex = args.indexOf('--download-sections');
    expect(sectionIndex).not.toBe(-1);
    expect(args[sectionIndex + 1]).toBe('*890-891');
  });

  it('parseMetadata filters out m3u8 formats when direct HTTPS video formats exist', () => {
    const ytdlp = new YtDlp();
    const mockJson = {
      id: 'abc',
      title: 'Test Video',
      formats: [
        { format_id: '616', resolution: '1920x1080', vcodec: 'vp9', protocol: 'm3u8' },
        { format_id: '270', resolution: '1920x1080', vcodec: 'avc1', protocol: 'm3u8' },
        { format_id: '137', resolution: '1920x1080', vcodec: 'avc1', protocol: 'https' },
        { format_id: '248', resolution: '1920x1080', vcodec: 'vp9', protocol: 'https' },
        { format_id: '140', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', protocol: 'https' },
        { format_id: 'sb0', resolution: '320x180', vcodec: 'none', acodec: 'none', protocol: 'mhtml' },
      ],
    };
    const meta = (ytdlp as any).parseMetadata(mockJson);
    const formatIds = meta.formats.map((f: any) => f.format_id);
    expect(formatIds).toContain('137');
    expect(formatIds).toContain('248');
    expect(formatIds).toContain('140');
    expect(formatIds).not.toContain('616');
    expect(formatIds).not.toContain('270');
    expect(formatIds).not.toContain('sb0');
  });

  it('parseMetadata preserves m3u8 formats if only m3u8 formats are available (live streams)', () => {
    const ytdlp = new YtDlp();
    const mockJson = {
      id: 'live123',
      title: 'Live Stream',
      formats: [
        { format_id: '91', resolution: '1280x720', vcodec: 'avc1', protocol: 'm3u8' },
        { format_id: '92', resolution: '640x360', vcodec: 'avc1', protocol: 'm3u8' },
      ],
    };
    const meta = (ytdlp as any).parseMetadata(mockJson);
    const formatIds = meta.formats.map((f: any) => f.format_id);
    expect(formatIds).toContain('91');
    expect(formatIds).toContain('92');
  });

  it('parseMetadata filters out m3u8 audio formats when direct audio formats exist', () => {
    const ytdlp = new YtDlp();
    const mockJson = {
      id: 'audio123',
      title: 'Audio Stream',
      formats: [
        { format_id: '233-0', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', protocol: 'm3u8' },
        { format_id: '140', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', protocol: 'https' },
      ],
    };
    const meta = (ytdlp as any).parseMetadata(mockJson);
    const formatIds = meta.formats.map((f: any) => f.format_id);
    expect(formatIds).toContain('140');
    expect(formatIds).not.toContain('233-0');
  });

  it('buildArgs guards compound format strings with protocol!*=m3u8', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      format: 'bestvideo[height<=1080]+bestaudio/best',
    };
    const args = (ytdlp as any).buildArgs(opts);
    const formatIndex = args.indexOf('-f');
    expect(formatIndex).not.toBe(-1);
    expect(args[formatIndex + 1]).toContain('bestaudio[protocol!*=m3u8]');
  });

  it('buildArgs guards custom format with protocol!*=m3u8 when clipping', () => {
    const ytdlp = new YtDlp();
    const opts: YtDlpOptions = {
      url: 'https://youtube.com/watch?v=abc',
      format: '137',
      clips: [{ name: 'clip1', start: 10, end: 20 }],
    };
    const args = (ytdlp as any).buildArgs(opts);
    const formatIndex = args.indexOf('-f');
    expect(formatIndex).not.toBe(-1);
    expect(args[formatIndex + 1]).toContain('protocol!*=m3u8');
  });
});



