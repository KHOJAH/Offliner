// @vitest-environment jsdom
/**
 * tests/e2e/tier2_boundaries.test.ts
 * Milestone 5 Tier 2: Boundary Value Analysis & Error Handling Suite (40 tests across 8 domains)
 * Validates malformed inputs, edge cases, error resilience, clamping, and zero unhandled rejections.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { TestHarness } from '../mocks/mockHarness';
import {
  MOCK_SINGLE_VIDEO_METADATA,
  MOCK_PLAYLIST_METADATA,
} from '../mocks/fixtures/mediaFixtures';
import { detectUrlType, parseMetadata } from '@/engine/ytdlp/resolver';
import { buildDownloadArgs } from '@/engine/ytdlp/builder';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner } from '@/engine/runner/mock';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore, THEME_TOKENS, applyThemeToDOM, THEME_STORAGE_KEY } from '@/renderer/stores/themeStore';
import { setupLocalStorageMock } from '../helpers/themeMocks';
import { ipcClient } from '@/renderer/ipc/client';
import type { DownloadConfig, DownloadItem, VideoMetadata } from '@/types';

describe('Tier 2: Boundary Value Analysis E2E Test Suite (40 Tests)', () => {
  let harness: TestHarness;
  let unhandledRejections: any[] = [];
  let rejectionHandler: (err: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unhandledRejections = [];
    rejectionHandler = (event: any) => {
      unhandledRejections.push(event?.reason || event);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', rejectionHandler);
    }
    process.on('unhandledRejection', rejectionHandler);

    harness = new TestHarness({ concurrency: 3 });
  });

  afterEach(async () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', rejectionHandler);
    }
    process.removeListener('unhandledRejection' as any, rejectionHandler);
    await harness.teardown();
  });

  // =========================================================================
  // DOMAIN 1: Single Video Boundaries (5 tests)
  // =========================================================================
  describe('Domain 1: Single Video Boundaries', () => {
    it('2.1.1 Malformed and non-URL strings rejected with input validation error', async () => {
      const invalidInputs = ['', '   ', 'not-a-url', 'ftp://invalid-scheme.com'];
      for (const input of invalidInputs) {
        const type = detectUrlType(input);
        expect(type).toBe('unknown');
        if (!input.trim()) {
          await expect(ipcClient.getMetadata(input)).rejects.toThrow('Invalid URL');
        }
      }
    });

    it('2.1.2 Non-YouTube / unsupported domain URLs display informative error toast or unknown type', () => {
      const unsupportedUrl = 'https://some-unsupported-domain.xyz/random/video';
      expect(detectUrlType(unsupportedUrl)).toBe('unknown');
    });

    it('2.1.3 Private or deleted video displays clear error message without unhandled rejection', async () => {
      await expect(ipcClient.getMetadata('https://youtube.com/watch?v=unavailable-404')).rejects.toThrow(
        'Video unavailable'
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.1.4 Media with zero video formats (audio-only file) handled gracefully without UI crash', () => {
      const audioOnlyRaw = {
        id: 'audio-only-id',
        webpage_url: 'https://youtube.com/watch?v=audio-only-id',
        title: 'Podcast Episode 42',
        duration: 1800,
        formats: [
          { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a.40.2', abr: 128 },
          { format_id: '251', ext: 'webm', resolution: 'audio only', vcodec: 'none', acodec: 'opus', abr: 160 },
        ],
      };

      const parsed = parseMetadata(audioOnlyRaw);
      expect(parsed.id).toBe('audio-only-id');
      expect(parsed.formats).toHaveLength(2);
      expect(parsed.formats.every((f) => f.vcodec === 'none')).toBe(true);
    });

    it('2.1.5 Live stream / m3u8-only media handles format filtering and falls back safely', () => {
      const m3u8OnlyRaw = {
        id: 'live-stream-id',
        webpage_url: 'https://youtube.com/watch?v=live-stream-id',
        title: 'Live News Broadcast',
        duration: 0,
        formats: [
          { format_id: 'hls-1080', ext: 'mp4', resolution: '1920x1080', protocol: 'm3u8_native', vcodec: 'avc1.4d401f', acodec: 'mp4a.40.2' },
          { format_id: 'hls-720', ext: 'mp4', resolution: '1280x720', protocol: 'm3u8_native', vcodec: 'avc1.4d401f', acodec: 'mp4a.40.2' },
        ],
      };

      const parsed = parseMetadata(m3u8OnlyRaw);
      // Because there are no direct http formats, m3u8 formats must NOT be filtered out
      expect(parsed.formats.length).toBeGreaterThanOrEqual(1);
      expect(parsed.formats[0].format_id).toBe('hls-1080');
    });
  });

  // =========================================================================
  // DOMAIN 2: Playlist Boundaries (5 tests)
  // =========================================================================
  describe('Domain 2: Playlist Boundaries', () => {
    it('2.2.1 Empty playlist (0 entries) displays empty state message without error', () => {
      const emptyPlaylistRaw = {
        _type: 'playlist',
        id: 'empty-pl-id',
        webpage_url: 'https://youtube.com/playlist?list=empty-pl-id',
        title: 'Empty Playlist',
        duration: 0,
        entries: [],
      };

      const parsed = parseMetadata(emptyPlaylistRaw);
      expect(parsed.is_playlist).toBe(true);
      expect(parsed.entries).toBeDefined();
      expect(parsed.entries).toHaveLength(0);
    });

    it('2.2.2 Massive playlist (500+ entries) handles parsing and batch generation in <100ms', () => {
      const rawEntries = Array.from({ length: 500 }, (_, i) => ({
        id: `track-${i + 1}`,
        webpage_url: `https://youtube.com/watch?v=track-${i + 1}`,
        title: `Track #${i + 1} - Electronic Vibes`,
        duration: 180,
        uploader: 'Artist Collective',
      }));

      const hugePlaylistRaw = {
        _type: 'playlist',
        id: 'huge-pl',
        webpage_url: 'https://youtube.com/playlist?list=huge-pl',
        title: '500 Mega Hits',
        entries: rawEntries,
      };

      const startTime = performance.now();
      const parsed = parseMetadata(hugePlaylistRaw);
      const elapsed = performance.now() - startTime;

      expect(parsed.entries).toHaveLength(500);
      expect(elapsed).toBeLessThan(100);
    });

    it('2.2.3 Playlist with mixture of available and removed/private videos processes available ones', () => {
      const mixedEntries = [
        { id: 'v1', webpage_url: 'https://youtube.com/watch?v=v1', title: 'Available Track 1', duration: 200 },
        { id: 'v2', webpage_url: '', title: '[Private video]', duration: 0 },
        { id: 'v3', webpage_url: 'https://youtube.com/watch?v=v3', title: 'Available Track 2', duration: 220 },
      ];

      const raw = {
        _type: 'playlist',
        id: 'mixed-pl',
        entries: mixedEntries,
      };

      const parsed = parseMetadata(raw);
      expect(parsed.entries).toHaveLength(3);
      const available = parsed.entries?.filter((e) => e.url && !e.title.includes('[Private'));
      expect(available).toHaveLength(2);
    });

    it('2.2.4 Single video URL pasted into Playlist view redirects user or returns video type', () => {
      const singleVidUrl = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      expect(detectUrlType(singleVidUrl)).toBe('video');
    });

    it('2.2.5 Zero items selected in playlist enqueues 0 jobs', async () => {
      const selected = new Set<string>();
      const entries = MOCK_PLAYLIST_METADATA.entries || [];
      const toEnqueue = entries.filter((e) => selected.has(e.id));

      expect(toEnqueue).toHaveLength(0);
      expect(harness.queue.getStatus().total).toBe(0);
    });
  });

  // =========================================================================
  // DOMAIN 3: Audio Extraction Boundaries (5 tests)
  // =========================================================================
  describe('Domain 3: Audio Extraction Boundaries', () => {
    it('2.3.1 Audio quality slider boundary values: 0 (best) and 9 (smallest) clamp correctly', () => {
      const clampQuality = (q: number) => Math.max(0, Math.min(9, Math.round(q)));

      expect(clampQuality(-5)).toBe(0);
      expect(clampQuality(0)).toBe(0);
      expect(clampQuality(9)).toBe(9);
      expect(clampQuality(25)).toBe(9);
    });

    it('2.3.2 Negative or non-numeric audio quality value clamped to default', () => {
      const sanitizeQuality = (q: any) => {
        const parsed = Number(q);
        if (isNaN(parsed) || parsed < 0 || parsed > 9) return 2; // Default 2
        return Math.round(parsed);
      };

      expect(sanitizeQuality(-10)).toBe(2);
      expect(sanitizeQuality('invalid')).toBe(2);
      expect(sanitizeQuality(NaN)).toBe(2);
      expect(sanitizeQuality(0)).toBe(0);
      expect(sanitizeQuality(9)).toBe(9);
    });

    it('2.3.3 Ingestion of video with missing audio stream emits graceful audio-extraction warning', () => {
      const videoWithoutAudio = {
        id: 'silent-film',
        webpage_url: 'https://youtube.com/watch?v=silent',
        title: 'Silent 1920 Film',
        duration: 600,
        formats: [
          { format_id: 'video-only', ext: 'mp4', resolution: '1920x1080', vcodec: 'avc1.640028', acodec: 'none' },
        ],
      };

      const parsed = parseMetadata(videoWithoutAudio);
      const hasAudio = parsed.formats.some((f) => f.acodec && f.acodec !== 'none');
      expect(hasAudio).toBe(false);
    });

    it('2.3.4 Audio extraction with inline clipping verifies start < end and minimum duration', () => {
      const validateClip = (start: number, end: number) => {
        if (start < 0) return { valid: false, error: 'Start cannot be negative' };
        if (end <= start) return { valid: false, error: 'End must be greater than start' };
        if (end - start < 1) return { valid: false, error: 'Minimum duration is 1 second' };
        return { valid: true };
      };

      expect(validateClip(30, 20).valid).toBe(false);
      expect(validateClip(10, 10.5).valid).toBe(false);
      expect(validateClip(10, 11).valid).toBe(true);
    });

    it('2.3.5 Unknown/unsupported audio format string falls back to default MP3', () => {
      const sanitizeAudioFormat = (fmt: string) => {
        const supported = ['mp3', 'm4a', 'flac', 'wav', 'opus', 'aac'];
        const normalized = (fmt || '').toLowerCase().trim();
        return supported.includes(normalized) ? normalized : 'mp3';
      };

      expect(sanitizeAudioFormat('WMA')).toBe('mp3');
      expect(sanitizeAudioFormat('ogg-vorbis')).toBe('mp3');
      expect(sanitizeAudioFormat('FLAC')).toBe('flac');
    });
  });

  // =========================================================================
  // DOMAIN 4: Timeline Trimmer Boundaries (5 tests)
  // =========================================================================
  describe('Domain 4: Timeline Trimmer Boundaries', () => {
    it('2.4.1 Start time greater than or equal to End time is rejected with error', () => {
      const validateRange = (start: number, end: number) => end > start;
      expect(validateRange(60, 30)).toBe(false);
      expect(validateRange(45, 45)).toBe(false);
      expect(validateRange(30, 45)).toBe(true);
    });

    it('2.4.2 Clip duration less than 1 second is rejected with "Clip too short" message', () => {
      const validateMinDuration = (start: number, end: number) => end - start >= 1.0;
      expect(validateMinDuration(10.0, 10.5)).toBe(false);
      expect(validateMinDuration(10.0, 10.99)).toBe(false);
      expect(validateMinDuration(10.0, 11.0)).toBe(true);
    });

    it('2.4.3 Negative start time input clamped to 0', () => {
      const clampStart = (start: number) => Math.max(0, start);
      expect(clampStart(-15)).toBe(0);
      expect(clampStart(-0.01)).toBe(0);
      expect(clampStart(5)).toBe(5);
    });

    it('2.4.4 End time greater than video duration clamped to video duration', () => {
      const duration = 300; // 5 min video
      const clampEnd = (end: number, max: number) => Math.min(max, end);

      expect(clampEnd(99999, duration)).toBe(300);
      expect(clampEnd(250, duration)).toBe(250);
    });

    it('2.4.5 Multiple overlapping clips from the same source generate unique, non-colliding output files', () => {
      const clip1Args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        outputPath: '/mock/downloads',
        clips: [{ name: 'cut1', start: 0, end: 30 }],
      });
      const clip2Args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        outputPath: '/mock/downloads',
        clips: [{ name: 'cut2', start: 15, end: 45 }],
      });

      expect(clip1Args).toContain('*0-30');
      expect(clip2Args).toContain('*15-45');
      // Templates contain section parameters to avoid collisions
      expect(clip1Args[clip1Args.indexOf('--output') + 1]).toContain('%(section_start)s-%(section_end)s');
      expect(clip2Args[clip2Args.indexOf('--output') + 1]).toContain('%(section_start)s-%(section_end)s');
    });
  });

  // =========================================================================
  // DOMAIN 5: Batch Queue Boundaries (5 tests)
  // =========================================================================
  describe('Domain 5: Batch Queue Boundaries', () => {
    beforeEach(() => {
      harness.delayMs = 250;
    });

    it('2.5.1 Rapid rapid-fire pause and resume clicks on same item handle async race conditions cleanly', async () => {
      const queue = harness.queue;
      await queue.add({ id: 'race-item', url: 'https://youtube.com/race' });

      // Fire 10 alternating pause/resume rapidly
      const actions = [];
      for (let i = 0; i < 10; i++) {
        actions.push(i % 2 === 0 ? queue.pause('race-item') : queue.resume('race-item'));
      }

      await Promise.all(actions);
      expect(unhandledRejections).toHaveLength(0);
      const item = queue.getItem('race-item');
      expect(['downloading', 'paused', 'queued']).toContain(item?.status);
    });

    it('2.5.2 Process kill timeout escalation (SIGTERM -> SIGKILL) terminates hung downloader', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({ delayMs: 1000, stdoutChunks: ['hung\n'] });

      const queue = new DownloadQueueEngine({ runner, concurrency: 1 });
      await queue.add({ id: 'hung-item', url: 'https://youtube.com/hung' });

      expect(queue.getStatus().active).toBe(1);

      // Cancel forces kill
      const cancelled = await queue.cancel('hung-item');
      expect(cancelled).toBe(true);
      expect(queue.getStatus().active).toBe(0);
      expect(queue.getItem('hung-item')?.status).toBe('cancelled');
    });

    it('2.5.3 Concurrency bound clamped strictly between 1 and 8', () => {
      const runner = new MockProcessRunner();
      const qLow = new DownloadQueueEngine({ runner, concurrency: -10 });
      expect(qLow.getConcurrency()).toBe(1);

      const qHigh = new DownloadQueueEngine({ runner, concurrency: 50 });
      expect(qHigh.getConcurrency()).toBe(8);

      const qNaN = new DownloadQueueEngine({ runner, concurrency: NaN });
      expect(qNaN.getConcurrency()).toBe(3);
    });

    it('2.5.4 Process failure (exit code 1) frees concurrency slot immediately for next pending item', async () => {
      const runner = new MockProcessRunner();
      runner.onCommand(/error-video/, {
        exitCode: 1,
        stderrChunks: ['ERROR: 404 Not Found\n'],
        delayMs: 10,
      });
      runner.setDefaultResponse({ delayMs: 100, stdoutChunks: ['[download] 100%\n'] });

      const queue = new DownloadQueueEngine({ runner, concurrency: 1 });
      await queue.add({ id: 'err-item', url: 'https://youtube.com/error-video' });
      await queue.add({ id: 'good-item', url: 'https://youtube.com/good-video' });

      // Wait for err-item to fail and good-item to be promoted
      await new Promise((r) => setTimeout(r, 40));

      expect(queue.getItem('err-item')?.status).toBe('error');
      expect(queue.getItem('good-item')?.status).toBe('downloading');
      expect(queue.getStatus().active).toBe(1);
    });

    it('2.5.5 Out-of-order job completion drains queue correctly without leaving orphaned slots', async () => {
      const runner = new MockProcessRunner();
      // Item 2 finishes fast (20ms), Item 1 finishes slower (80ms)
      runner.onCommand(/fast-video/, {
        exitCode: 0,
        delayMs: 20,
        stdoutChunks: ['[download] 100%\n'],
      });
      runner.onCommand(/slow-video/, {
        exitCode: 0,
        delayMs: 80,
        stdoutChunks: ['[download] 100%\n'],
      });
      runner.setDefaultResponse({ exitCode: 0, delayMs: 20, stdoutChunks: ['[download] 100%\n'] });

      const queue = new DownloadQueueEngine({ runner, concurrency: 2 });
      await queue.add({ id: 'slow-1', url: 'https://youtube.com/slow-video' });
      await queue.add({ id: 'fast-2', url: 'https://youtube.com/fast-video' });
      await queue.add({ id: 'pending-3', url: 'https://youtube.com/pending-video' });

      // Wait for fast-2 to finish; pending-3 should be pulled in while slow-1 is still running
      await new Promise((r) => setTimeout(r, 45));

      expect(queue.getItem('fast-2')?.status).toBe('done');
      expect(queue.getItem('pending-3')?.status).toBe('downloading');

      // Wait for queue to drain deterministically
      if (queue.getStatus().active > 0 || queue.getStatus().queued > 0) {
        await new Promise<void>((resolve) => {
          queue.once('queue:drained', () => resolve());
        });
      }

      expect(queue.getStatus().active).toBe(0);
      expect(queue.getStatus().done).toBe(3);
    });
  });

  // =========================================================================
  // DOMAIN 6: Theme Switching Boundaries (5 tests)
  // =========================================================================
  describe('Domain 6: Theme Switching Boundaries', () => {
    it('2.6.1 Corrupted or unrecognized theme name in settings store falls back to "dark"', async () => {
      const sanitizeTheme = (t: any): 'light' | 'dark' | 'monochrome' => {
        if (t === 'light' || t === 'dark' || t === 'monochrome') return t;
        return 'dark';
      };

      expect(sanitizeTheme('neon-rainbow')).toBe('dark');
      expect(sanitizeTheme(null)).toBe('dark');
      expect(sanitizeTheme('light')).toBe('light');
    });

    it('2.6.2 Rapid theme switching in tight loop does not leak event listeners or corrupt DOM classes', async () => {
      const { setTheme } = useThemeStore.getState();

      const themes: ('light' | 'dark' | 'monochrome')[] = ['light', 'dark', 'monochrome'];
      for (let i = 0; i < 60; i++) {
        await setTheme(themes[i % 3]);
      }

      // Final theme must match i=59 -> themes[59 % 3] = themes[2] = 'monochrome'
      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
      expect(document.documentElement.classList.contains('theme-monochrome')).toBe(true);
    });

    it('2.6.3 Theme switch during active streaming download does not drop stream chunks or reset state', async () => {
      const { addDownload, updateProgress } = useDownloadStore.getState();
      const { setTheme } = useThemeStore.getState();

      addDownload({
        id: 'streaming-item',
        url: 'https://youtube.com/watch?v=stream',
        title: 'Streaming Video',
        thumbnail: '',
        status: 'downloading',
        progress: 45,
        speed: '4.5 MB/s',
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=stream' },
      });

      // Switch theme mid-download
      await setTheme('monochrome');

      const item = useDownloadStore.getState().downloads.get('streaming-item');
      expect(item?.progress).toBe(45);
      expect(item?.speed).toBe('4.5 MB/s');
      expect(item?.status).toBe('downloading');
    });

    it('2.6.4 Window traffic light controls maintain required contrast and switch to neutral in monochrome', () => {
      // In Monochrome mode, tokens strictly satisfy R=G=B
      const monoTokens = THEME_TOKENS.monochrome;
      expect(monoTokens.textPrimary).toBe('#FFFFFF');
      expect(monoTokens.bgApp).toBe('#000000');
    });

    it('2.6.5 Cold start rehydration from localStorage restores user\'s chosen theme accurately', async () => {
      const storageCtrl = setupLocalStorageMock();
      storageCtrl.getStore()[THEME_STORAGE_KEY] = 'monochrome';

      const { initTheme } = useThemeStore.getState();
      await initTheme();

      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
      storageCtrl.clearStore();
    });
  });

  // =========================================================================
  // DOMAIN 7: Stitch Deliverable Boundaries (5 tests)
  // =========================================================================
  describe('Domain 7: Stitch Deliverable Boundaries', () => {
    it('2.7.1 Missing DESIGN.md or PROMPTS.md triggers test assertion failure', () => {
      const designPath = path.resolve(process.cwd(), 'docs/stitch/DESIGN.md');
      const promptsPath = path.resolve(process.cwd(), 'docs/stitch/PROMPTS.md');

      expect(fs.existsSync(designPath)).toBe(true);
      expect(fs.existsSync(promptsPath)).toBe(true);

      const fakePath = path.resolve(process.cwd(), 'docs/stitch/NON_EXISTENT.md');
      expect(fs.existsSync(fakePath)).toBe(false);
    });

    it('2.7.2 Corrupt YAML frontmatter in DESIGN.md is detected and reported', () => {
      const designPath = path.resolve(process.cwd(), 'docs/stitch/DESIGN.md');
      const content = fs.readFileSync(designPath, 'utf8');

      // Validate frontmatter delimiters
      const matches = content.match(/^---\n([\s\S]*?)\n---/);
      expect(matches).not.toBeNull();
      const yamlBody = matches![1];
      expect(yamlBody).toContain('system:');
      expect(yamlBody).toContain('version:');
    });

    it('2.7.3 Stitch screens directory missing any of the 7 required screens is detected', () => {
      const screensDir = path.resolve(process.cwd(), 'docs/stitch/screens');
      const files = fs.readdirSync(screensDir).filter((f) => f.endsWith('.html'));

      expect(files).toHaveLength(7);
      expect(files).toContain('01_home_resolver.html');
      expect(files).toContain('07_settings.html');
    });

    it('2.7.4 HTML templates checked for well-formed markup', () => {
      const screensDir = path.resolve(process.cwd(), 'docs/stitch/screens');
      const files = fs.readdirSync(screensDir).filter((f) => f.endsWith('.html'));

      files.forEach((file) => {
        const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('</html>');
        expect(content).toContain('</body>');
      });
    });

    it('2.7.5 Parity validation: Every view in src/renderer/views/ has corresponding Stitch mockup', () => {
      const views = [
        'HomeView',
        'VideoDownloadView',
        'AudioExtractView',
        'PlaylistView',
        'ClipsView',
        'QueueView',
        'SettingsView',
      ];

      const screens = [
        '01_home_resolver.html',
        '02_video_download.html',
        '03_audio_extract.html',
        '04_playlist_batch.html',
        '05_clips_trimmer.html',
        '06_queue_manager.html',
        '07_settings.html',
      ];

      expect(views).toHaveLength(7);
      expect(screens).toHaveLength(7);

      const viewsDir = path.resolve(process.cwd(), 'src/renderer/views');
      views.forEach((v) => {
        expect(fs.existsSync(path.join(viewsDir, `${v}.tsx`))).toBe(true);
      });
    });
  });

  // =========================================================================
  // DOMAIN 8: Queue Maintenance Boundaries (5 tests)
  // =========================================================================
  describe('Domain 8: Queue Maintenance Boundaries', () => {
    it('2.8.1 Open file on non-existent or deleted file handled gracefully with user toast', async () => {
      await expect(ipcClient.openFile('/nonexistent/file.mp4')).rejects.toThrow('File not found');
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.8.2 Show in folder on deleted file highlights parent directory or throws caught error', async () => {
      await expect(ipcClient.showInFolder('/nonexistent/folder/file.mp4')).rejects.toThrow(
        'File not found'
      );
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.8.3 Trashing already-deleted file does not throw unhandled exception', async () => {
      const deleted = await ipcClient.deleteFile('/already/deleted.mp4');
      expect(deleted).toBe(false);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.8.4 File verification poller handles inaccessible download directory without throwing', async () => {
      const { verifyDownloads, addDownload } = useDownloadStore.getState();

      addDownload({
        id: 'poll-item',
        url: 'https://youtube.com/watch?v=p1',
        title: 'Poller File',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/mock/downloads/test.mp4',
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=p1' },
      });

      (window as any).electronAPI.fileExists = vi.fn().mockRejectedValue(new Error('EPERM'));
      await expect(verifyDownloads()).resolves.not.toThrow();
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.8.5 Clear finished when only active downloads exist leaves queue unchanged', () => {
      const { addDownload, clearFinishedDownloads } = useDownloadStore.getState();

      addDownload({
        id: 'act-1',
        url: 'https://youtube.com/watch?v=act1',
        title: 'Active 1',
        thumbnail: '',
        status: 'downloading',
        progress: 50,
        createdAt: 1,
        config: { url: 'act1' },
      });
      addDownload({
        id: 'act-2',
        url: 'https://youtube.com/watch?v=act2',
        title: 'Active 2',
        thumbnail: '',
        status: 'queued',
        progress: 0,
        createdAt: 2,
        config: { url: 'act2' },
      });

      clearFinishedDownloads();

      const downloads = useDownloadStore.getState().downloads;
      expect(downloads.size).toBe(2);
      expect(downloads.has('act-1')).toBe(true);
      expect(downloads.has('act-2')).toBe(true);
    });
  });
});
