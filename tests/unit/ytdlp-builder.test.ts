/**
 * tests/unit/ytdlp-builder.test.ts
 * Unit tests for pure CLI argument builders and metadata resolver.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDownloadArgs,
  buildMetadataArgs,
  buildFormatString,
  MAX_QUALITY_FORMAT,
  CLIP_AUDIO_FORMAT,
  type DownloadOptions,
  type SupportedAudioFormat,
} from '@/engine/ytdlp/builder';
import {
  YtDlpResolver,
  detectUrlType,
  parseMetadata,
  getBestThumbnail,
} from '@/engine/ytdlp/resolver';
import { MockProcessRunner } from '@/engine/runner/mock';

describe('yt-dlp Pure CLI Argument Builder', () => {
  const baseVideoOpts: DownloadOptions = {
    url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  };

  // SUITE 1: General & Invariants
  describe('Suite 1: General & Invariants', () => {
    it('1.1 guarantees pure immutability of passed options', () => {
      const frozenOpts = Object.freeze({
        url: 'https://youtube.com/watch?v=abc',
        format: '137',
        clips: Object.freeze([{ start: 5, end: 15 }]),
      }) as DownloadOptions;

      expect(() => buildDownloadArgs(frozenOpts)).not.toThrow();
    });

    it('1.2 places URL strictly at the terminal position', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      expect(args[args.length - 1]).toBe(baseVideoOpts.url);
    });

    it('1.3 includes standard output and sanitization flags', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      expect(args).toContain('--newline');
      expect(args).toContain('--force-overwrites');
      expect(args).toContain('--restrict-filenames');
      expect(args).toContain('--no-check-certificates');
    });

    it('1.4 includes --no-update flag', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      expect(args).toContain('--no-update');
    });

    it('1.5 includes --format-sort proto', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      const sortIdx = args.indexOf('--format-sort');
      expect(sortIdx).not.toBe(-1);
      expect(args[sortIdx + 1]).toBe('proto');
    });

    it('1.6 includes extractor args for player client web_embedded,web', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      const extIdx = args.indexOf('--extractor-args');
      expect(extIdx).not.toBe(-1);
      expect(args[extIdx + 1]).toBe('youtube:player_client=web_embedded,web');
    });

    it('1.7 falls back to default JS runtimes deno and node', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      const rtIndices = args
        .map((a, i) => (a === '--js-runtimes' ? args[i + 1] : null))
        .filter(Boolean);
      expect(rtIndices).toContain('deno');
      expect(rtIndices).toContain('node');
    });

    it('1.8 accepts custom JS runtimes from context', () => {
      const args = buildDownloadArgs(baseVideoOpts, {
        jsRuntimes: ['bun:/usr/bin/bun', 'quickjs'],
      });
      const rtIndices = args
        .map((a, i) => (a === '--js-runtimes' ? args[i + 1] : null))
        .filter(Boolean);
      expect(rtIndices).toContain('bun:/usr/bin/bun');
      expect(rtIndices).toContain('quickjs');
      expect(rtIndices).not.toContain('deno');
    });

    it('1.9 includes --ffmpeg-location when provided in context', () => {
      const args = buildDownloadArgs(baseVideoOpts, {
        ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      });
      const ffIdx = args.indexOf('--ffmpeg-location');
      expect(ffIdx).not.toBe(-1);
      expect(args[ffIdx + 1]).toBe('/opt/homebrew/bin/ffmpeg');
    });
  });

  // SUITE 2: Video & DASH Merging
  describe('Suite 2: Video & DASH Merging', () => {
    it('2.1 merges best audio with single DASH video stream ID', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, format: '137' });
      const fIdx = args.indexOf('-f');
      expect(fIdx).not.toBe(-1);
      expect(args[fIdx + 1]).toBe(`137+bestaudio[protocol!*=m3u8]/${MAX_QUALITY_FORMAT}`);
    });

    it('2.2 merges best audio with progressive stream ID', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, format: '18' });
      const fIdx = args.indexOf('-f');
      expect(fIdx).not.toBe(-1);
      expect(args[fIdx + 1]).toBe(`18+bestaudio[protocol!*=m3u8]/${MAX_QUALITY_FORMAT}`);
    });

    it('2.3 maps format "best" or "b" to MAX_QUALITY_FORMAT', () => {
      const argsBest = buildDownloadArgs({ ...baseVideoOpts, format: 'best' });
      const fIdxBest = argsBest.indexOf('-f');
      expect(argsBest[fIdxBest + 1]).toBe(MAX_QUALITY_FORMAT);

      const argsB = buildDownloadArgs({ ...baseVideoOpts, format: 'b' });
      const fIdxB = argsB.indexOf('-f');
      expect(argsB[fIdxB + 1]).toBe(MAX_QUALITY_FORMAT);
    });

    it('2.4 patches compound format strings with protocol!*=m3u8', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        format: 'bestvideo[height<=1080]+bestaudio/best',
      });
      const fIdx = args.indexOf('-f');
      expect(fIdx).not.toBe(-1);
      expect(args[fIdx + 1]).toContain('bestaudio[protocol!*=m3u8]');
    });

    it('2.5 patches bracketed format strings with protocol!*=m3u8', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        format: 'best[height<=720]',
      });
      const fIdx = args.indexOf('-f');
      expect(fIdx).not.toBe(-1);
      expect(args[fIdx + 1]).toBe('best[height<=720][protocol!*=m3u8]');
    });

    it('2.6 defaults video container to mp4 merge and remux', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, format: '137' });
      const mergeIdx = args.indexOf('--merge-output-format');
      expect(args[mergeIdx + 1]).toBe('mp4');
      const remuxIdx = args.indexOf('--remux-video');
      expect(args[remuxIdx + 1]).toBe('mp4');
    });

    it('2.7 respects custom video container', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, videoFormat: 'mkv' });
      const mergeIdx = args.indexOf('--merge-output-format');
      expect(args[mergeIdx + 1]).toBe('mkv');
      const remuxIdx = args.indexOf('--remux-video');
      expect(args[remuxIdx + 1]).toBe('mkv');
    });

    it('2.8 emits --no-audio-multistreams for video downloads to prevent echo', () => {
      const args = buildDownloadArgs(baseVideoOpts);
      expect(args).toContain('--no-audio-multistreams');
      expect(args).not.toContain('--audio-multistreams');
    });
  });

  // SUITE 3: Audio Extraction
  describe('Suite 3: Audio Extraction', () => {
    it('3.1 emits -x, format, and --audio-multistreams without video remuxing', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        extractAudio: true,
        audioFormat: 'mp3',
      });
      expect(args).toContain('-x');
      const fmtIdx = args.indexOf('--audio-format');
      expect(args[fmtIdx + 1]).toBe('mp3');
      expect(args).toContain('--audio-multistreams');
      expect(args).not.toContain('--merge-output-format');
      expect(args).not.toContain('--remux-video');
    });

    it('3.2 correctly sets all supported audio codecs', () => {
      const codecs: SupportedAudioFormat[] = ['mp3', 'm4a', 'flac', 'wav', 'opus', 'aac'];
      for (const codec of codecs) {
        const args = buildDownloadArgs({
          ...baseVideoOpts,
          extractAudio: true,
          audioFormat: codec,
        });
        const fmtIdx = args.indexOf('--audio-format');
        expect(args[fmtIdx + 1]).toBe(codec);
      }
    });

    it('3.3 normalizes audio format case to lowercase', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        extractAudio: true,
        audioFormat: 'FLAC',
      });
      const fmtIdx = args.indexOf('--audio-format');
      expect(args[fmtIdx + 1]).toBe('flac');
    });

    it('3.4 sets audio quality compression level (0-9)', () => {
      for (const q of [0, 5, 9]) {
        const args = buildDownloadArgs({
          ...baseVideoOpts,
          extractAudio: true,
          audioFormat: 'mp3',
          audioQuality: q,
        });
        const qIdx = args.indexOf('--audio-quality');
        expect(args[qIdx + 1]).toBe(String(q));
      }
    });

    it('3.5 does not inject -f for audio extraction without clips', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        extractAudio: true,
        audioFormat: 'mp3',
      });
      expect(args).not.toContain('-f');
    });

    it('3.6 injects CLIP_AUDIO_FORMAT and skips keyframe cuts for audio clipping', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        extractAudio: true,
        audioFormat: 'mp3',
        clips: [{ start: 10, end: 30 }],
      });
      const fIdx = args.indexOf('-f');
      expect(args[fIdx + 1]).toBe(CLIP_AUDIO_FORMAT);
      expect(args).not.toContain('--force-keyframes-at-cuts');
    });
  });

  // SUITE 4: Keyframe Cuts & Soft-Seek
  describe('Suite 4: Keyframe Cuts & Soft-Seek', () => {
    it('4.1 builds single clip args with keyframes and short seek size', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [{ name: 'intro', start: 10, end: 30 }],
      });
      const secIdx = args.indexOf('--download-sections');
      expect(args[secIdx + 1]).toBe('*10-30');
      expect(args).toContain('--force-keyframes-at-cuts');
      const dlArgIdx = args.indexOf('--downloader-args');
      expect(args[dlArgIdx + 1]).toBe('ffmpeg_i:-short_seek_size 1');
    });

    it('4.2 builds multiple clip sections in order', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [
          { start: 10, end: 30 },
          { start: 60, end: 90 },
        ],
      });
      const sections = args
        .map((a, i) => (a === '--download-sections' ? args[i + 1] : null))
        .filter(Boolean);
      expect(sections).toEqual(['*10-30', '*60-90']);
    });

    it('4.3 clamps negative clip start time to 0', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [{ start: -15, end: 20 }],
      });
      const secIdx = args.indexOf('--download-sections');
      expect(args[secIdx + 1]).toBe('*0-20');
    });

    it('4.4 clamps end time when start >= end to start + 1', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [{ start: 50, end: 50 }],
      });
      const secIdx = args.indexOf('--download-sections');
      expect(args[secIdx + 1]).toBe('*50-51');
    });

    it('4.5 sets clip output template with section start and end', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        outputPath: '/downloads',
        clips: [{ start: 10, end: 20 }],
      });
      const outIdx = args.indexOf('--output');
      expect(args[outIdx + 1]).toContain('%(section_start)s-%(section_end)s');
    });

    it('4.6 defaults format to MAX_QUALITY_FORMAT for clips without format', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [{ start: 5, end: 15 }],
      });
      const fIdx = args.indexOf('-f');
      expect(args[fIdx + 1]).toBe(MAX_QUALITY_FORMAT);
    });

    it('4.7 preserves custom format with audio merging when clipping', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        format: '137',
        clips: [{ start: 5, end: 15 }],
      });
      const fIdx = args.indexOf('-f');
      expect(args[fIdx + 1]).toBe(`137+bestaudio[protocol!*=m3u8]/${MAX_QUALITY_FORMAT}`);
    });

    it('4.8 omits --external-downloader during clipping', () => {
      const args = buildDownloadArgs({
        ...baseVideoOpts,
        clips: [{ start: 10, end: 20 }],
      });
      expect(args).not.toContain('--external-downloader');
    });
  });

  // SUITE 5: Playlist & Resume
  describe('Suite 5: Playlist & Resume', () => {
    it('5.1 sets --yes-playlist when isPlaylist is true', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, isPlaylist: true });
      expect(args).toContain('--yes-playlist');
    });

    it('5.2 sets --no-playlist when noPlaylist is true', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, noPlaylist: true });
      expect(args).toContain('--no-playlist');
    });

    it('5.3 sets --continue when continueDownload is true', () => {
      const args = buildDownloadArgs({ ...baseVideoOpts, continueDownload: true });
      expect(args).toContain('--continue');
    });

    it('5.4 includes --flat-playlist for list= URLs in buildMetadataArgs', () => {
      const args = buildMetadataArgs('https://youtube.com/playlist?list=PL123456');
      expect(args).toContain('--flat-playlist');
    });

    it('5.5 includes --dump-single-json and extraction flags in buildMetadataArgs', () => {
      const args = buildMetadataArgs(baseVideoOpts.url);
      expect(args).toContain('--dump-single-json');
      expect(args).toContain('--no-download');
      expect(args).toContain('--no-warnings');
      expect(args[args.length - 1]).toBe(baseVideoOpts.url);
    });
  });
});

describe('yt-dlp Metadata Resolver & Universal URL Router', () => {
  let mockRunner: MockProcessRunner;
  let resolver: YtDlpResolver;

  beforeEach(() => {
    mockRunner = new MockProcessRunner();
    resolver = new YtDlpResolver(mockRunner);
  });

  describe('Suite 6: Metadata Resolution & Normalization', () => {
    it('6.1 resolves single video metadata correctly', async () => {
      const mockJson = {
        id: 'abc12345678',
        webpage_url: 'https://youtube.com/watch?v=abc12345678',
        title: 'Rick Astley - Never Gonna Give You Up',
        duration: 212,
        thumbnail: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg',
        uploader: 'Rick Astley',
        formats: [
          {
            format_id: '137',
            ext: 'mp4',
            resolution: '1920x1080',
            vcodec: 'avc1',
            protocol: 'https',
          },
        ],
      };

      mockRunner.onCommand(/yt-dlp/, {
        exitCode: 0,
        stdoutChunks: [JSON.stringify(mockJson)],
      });

      const meta = await resolver.fetchMetadata('https://youtube.com/watch?v=abc12345678');
      expect(meta.id).toBe('abc12345678');
      expect(meta.title).toBe('Rick Astley - Never Gonna Give You Up');
      expect(meta.duration).toBe(212);
      expect(meta.is_playlist).toBe(false);
      expect(meta.formats.length).toBe(1);
    });

    it('6.2 normalizes width/height into resolution string fallback', () => {
      const mockJson = {
        id: 'res-test',
        formats: [
          { format_id: '1', vcodec: 'avc1', width: 1280, height: 720 },
          { format_id: '2', vcodec: 'avc1', height: 480 },
          { format_id: '3', vcodec: 'none', acodec: 'mp4a' },
        ],
      };

      const meta = parseMetadata(mockJson as any);
      expect(meta.formats[0].resolution).toBe('1280x720');
      expect(meta.formats[1].resolution).toBe('480p');
      expect(meta.formats[2].resolution).toBe('audio only');
    });

    it('6.3 selects last thumbnail as highest resolution thumbnail', () => {
      const mockJson = {
        thumbnails: [
          { url: 'https://thumb.low' },
          { url: 'https://thumb.med' },
          { url: 'https://thumb.max' },
        ],
      };
      expect(getBestThumbnail(mockJson)).toBe('https://thumb.max');
    });

    it('6.4 maps playlist entries correctly', async () => {
      const playlistJson = {
        _type: 'playlist',
        id: 'PL123',
        title: 'My Playlist',
        entries: [
          { id: 'vid1', title: 'Video 1', duration: 100 },
          { id: 'vid2', title: 'Video 2', duration: 200 },
        ],
      };

      mockRunner.onCommand(/yt-dlp/, {
        exitCode: 0,
        stdoutChunks: [JSON.stringify(playlistJson)],
      });

      const meta = await resolver.fetchMetadata('https://youtube.com/playlist?list=PL123');
      expect(meta.is_playlist).toBe(true);
      expect(meta.entries?.length).toBe(2);
      expect(meta.entries?.[0].id).toBe('vid1');
    });

    it('6.5 strips mhtml and storyboard formats', () => {
      const mockJson = {
        id: 'strip-test',
        formats: [
          { format_id: 'sb0', protocol: 'mhtml', vcodec: 'none' },
          { format_id: 'sb1', format_note: 'storyboard', vcodec: 'none' },
          { format_id: '137', protocol: 'https', vcodec: 'avc1' },
        ],
      };

      const meta = parseMetadata(mockJson as any);
      expect(meta.formats.length).toBe(1);
      expect(meta.formats[0].format_id).toBe('137');
    });

    it('6.6 strips m3u8 formats when direct HTTPS video formats exist', () => {
      const mockJson = {
        id: 'hls-strip',
        formats: [
          { format_id: 'm3u8-1', protocol: 'm3u8', vcodec: 'avc1' },
          { format_id: 'https-1', protocol: 'https', vcodec: 'avc1' },
        ],
      };

      const meta = parseMetadata(mockJson as any);
      expect(meta.formats.length).toBe(1);
      expect(meta.formats[0].format_id).toBe('https-1');
    });

    it('6.7 preserves m3u8 formats for live streams with no direct formats', () => {
      const mockJson = {
        id: 'live-stream',
        formats: [
          { format_id: '91', protocol: 'm3u8', vcodec: 'avc1' },
          { format_id: '92', protocol: 'm3u8', vcodec: 'avc1' },
        ],
      };

      const meta = parseMetadata(mockJson as any);
      expect(meta.formats.length).toBe(2);
    });

    it('6.8 throws descriptive error when process exits with non-zero exit code', async () => {
      mockRunner.onCommand(/yt-dlp/, {
        exitCode: 1,
        stderrChunks: ['ERROR: Video unavailable'],
      });

      await expect(resolver.fetchMetadata('https://youtube.com/watch?v=bad')).rejects.toThrow(
        'yt-dlp metadata failed (exit 1): ERROR: Video unavailable'
      );
    });

    it('6.9 throws descriptive error on corrupt JSON stdout', async () => {
      mockRunner.onCommand(/yt-dlp/, {
        exitCode: 0,
        stdoutChunks: ['<html>502 Bad Gateway</html>'],
      });

      await expect(resolver.fetchMetadata('https://youtube.com/watch?v=bad')).rejects.toThrow(
        'Failed to parse yt-dlp JSON'
      );
    });

    it('6.10 routes URLs correctly via detectUrlType', () => {
      expect(detectUrlType('https://youtube.com/playlist?list=PL123')).toBe('playlist');
      expect(detectUrlType('https://youtube.com/watch?v=abc&list=PL123')).toBe('playlist');
      expect(detectUrlType('https://youtube.com/watch?v=abc')).toBe('video');
      expect(detectUrlType('https://youtu.be/abc')).toBe('video');
      expect(detectUrlType('https://youtube.com/shorts/abc')).toBe('video');
      expect(detectUrlType('https://example.com/other')).toBe('unknown');
    });
  });
});
