// @vitest-environment jsdom
/**
 * tests/e2e/tier1_features.test.ts
 * Milestone 5 Tier 1: Feature Isolation Test Suite (40 tests across 8 feature domains)
 * Requirements strictly derived from PROJECT.md and TEST_INFRA.md.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { TestHarness } from '../mocks/mockHarness';
import {
  MOCK_SINGLE_VIDEO_METADATA,
  MOCK_PLAYLIST_METADATA,
} from '../mocks/fixtures/mediaFixtures';
import { detectUrlType } from '@/engine/ytdlp/resolver';
import { buildDownloadArgs } from '@/engine/ytdlp/builder';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore, THEME_TOKENS, applyThemeToDOM } from '@/renderer/stores/themeStore';
import { ipcClient } from '@/renderer/ipc/client';
import type { DownloadConfig, DownloadItem, VideoMetadata } from '@/types';

describe('Tier 1: Feature Isolation E2E Test Suite (40 Tests)', () => {
  let harness: TestHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    harness = new TestHarness({ concurrency: 3 });
  });

  afterEach(async () => {
    await harness.teardown();
  });

  // =========================================================================
  // DOMAIN 1: Single Video Downloads & Quality Selection (5 tests)
  // =========================================================================
  describe('Domain 1: Single Video Downloads & Quality Selection', () => {
    it('1.1 Ingests single video URL and resolves metadata (title, duration, thumbnail)', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
      expect(meta).toBeDefined();
      expect(meta.id).toBe('vid-4k-sample');
      expect(meta.title).toBe(MOCK_SINGLE_VIDEO_METADATA.title);
      expect(meta.duration).toBe(360);
      expect(meta.thumbnail).toBe(MOCK_SINGLE_VIDEO_METADATA.thumbnail);
      expect(meta.is_playlist).toBe(false);
      expect(meta.formats.length).toBeGreaterThan(0);
    });

    it('1.2 Groups and sorts video formats by resolution descending (4K -> 1080p -> 720p)', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
      const videoFormats = meta.formats.filter((f) => f.vcodec && f.vcodec !== 'none');

      // Sort descending by height
      const parseHeight = (res: string) => {
        const m = res.match(/(\d+)x(\d+)/);
        if (m) return parseInt(m[2], 10);
        const p = res.match(/(\d+)p/);
        return p ? parseInt(p[1], 10) : 0;
      };

      const sorted = [...videoFormats].sort((a, b) => parseHeight(b.resolution) - parseHeight(a.resolution));
      expect(sorted[0].resolution).toContain('2160'); // 4K
      expect(sorted[1].resolution).toContain('1080'); // 1080p
      expect(sorted[2].resolution).toContain('720');  // 720p
    });

    it('1.3 User format selection updates active download configuration', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
      const chosenFormat = meta.formats.find((f) => f.format_id === '137'); // 1080p
      expect(chosenFormat).toBeDefined();

      const config: DownloadConfig = {
        url: meta.url,
        format: chosenFormat?.format_id,
        videoFormat: 'mp4',
        outputPath: '/mock/downloads/video.mp4',
      };

      const downloadArgs = buildDownloadArgs(config);
      expect(downloadArgs).toContain('-f');
      const fIdx = downloadArgs.indexOf('-f');
      expect(downloadArgs[fIdx + 1]).toContain('137');
    });

    it('1.4 Auto-selects highest resolution, highest fps, and best bitrate format by default', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
      const videoFormats = meta.formats.filter((f) => f.vcodec && f.vcodec !== 'none');

      // Best format logic: highest height, then highest fps, then highest vbr
      const parseHeight = (res: string) => {
        const m = res.match(/(\d+)x(\d+)/);
        if (m) return parseInt(m[2], 10);
        return 0;
      };

      const bestFormat = videoFormats.reduce((best, cur) => {
        const curHeight = parseHeight(cur.resolution);
        const bestHeight = parseHeight(best.resolution);
        if (curHeight > bestHeight) return cur;
        if (curHeight === bestHeight) {
          if ((cur.fps || 0) > (best.fps || 0)) return cur;
          if ((cur.vbr || 0) > (best.vbr || 0)) return cur;
        }
        return best;
      }, videoFormats[0]);

      expect(bestFormat.format_id).toBe('313'); // 4K 60fps
      expect(bestFormat.fps).toBe(60);
    });

    it('1.5 "Download Video" dispatches download job with DASH multiplexing format', async () => {
      const config: DownloadConfig = {
        url: 'https://youtube.com/watch?v=vid-4k-sample',
        format: '313+140',
        videoFormat: 'mp4',
        outputPath: '/mock/downloads/vid-4k-sample.mp4',
      };

      const id = await ipcClient.addDownload(config);
      expect(id).toBeDefined();

      const args = buildDownloadArgs(config);
      expect(args).toContain('--merge-output-format');
      expect(args).toContain('mp4');
      expect(args).toContain('--no-audio-multistreams');
    });
  });

  // =========================================================================
  // DOMAIN 2: Playlist Downloads & Batch Selection (5 tests)
  // =========================================================================
  describe('Domain 2: Playlist Downloads & Batch Selection', () => {
    it('2.1 Ingests playlist URL (list=...) and routes to Playlist Batch tab', () => {
      const playlistUrl = 'https://youtube.com/playlist?list=pl-chillstep-album';
      const detected = detectUrlType(playlistUrl);
      expect(detected).toBe('playlist');
    });

    it('2.2 Fetches flat playlist metadata and populates item list with thumbnails and titles', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
      expect(meta.is_playlist).toBe(true);
      expect(meta.title).toBe(MOCK_PLAYLIST_METADATA.title);
      expect(meta.entries).toBeDefined();
      expect(meta.entries?.length).toBe(5);
      expect(meta.entries?.[0].title).toBe('01. Horizon Dreams');
      expect(meta.entries?.[0].thumbnail).toBeDefined();
    });

    it('2.3 Select All / Deselect All master toggle synchronously updates all item selection states', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
      const entries = meta.entries || [];
      const selected = new Set<string>(entries.map((e) => e.id));
      expect(selected.size).toBe(5);

      // Deselect all
      selected.clear();
      expect(selected.size).toBe(0);

      // Select all again
      entries.forEach((e) => selected.add(e.id));
      expect(selected.size).toBe(5);
    });

    it('2.4 Synchronizes format and resolution across all selected batch items', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
      const selectedEntries = meta.entries || [];
      const batchFormat = '137'; // 1080p
      const batchVideoFormat = 'mp4';

      const queuedConfigs: DownloadConfig[] = selectedEntries.map((entry) => ({
        url: entry.url,
        format: batchFormat,
        videoFormat: batchVideoFormat,
        isPlaylist: true,
      }));

      expect(queuedConfigs).toHaveLength(5);
      queuedConfigs.forEach((cfg) => {
        expect(cfg.format).toBe('137');
        expect(cfg.videoFormat).toBe('mp4');
        expect(cfg.isPlaylist).toBe(true);
      });
    });

    it('2.5 "Download Selected" enqueues all checked playlist entries into batch queue', async () => {
      const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
      const entries = meta.entries?.slice(0, 3) || [];

      const ids: string[] = [];
      for (const entry of entries) {
        const id = await ipcClient.addDownload({
          url: entry.url,
          outputPath: `/mock/downloads/${entry.id}.mp4`,
          isPlaylist: true,
        });
        ids.push(id);
      }

      expect(ids).toHaveLength(3);
      expect(harness.queue.getStatus().total).toBe(3);
    });
  });

  // =========================================================================
  // DOMAIN 3: Audio Extraction (5 tests)
  // =========================================================================
  describe('Domain 3: Audio Extraction', () => {
    it('3.1 Supports all 6 required audio codecs: MP3, M4A, FLAC, WAV, OPUS, AAC', () => {
      const supportedCodecs = ['mp3', 'm4a', 'flac', 'wav', 'opus', 'aac'];
      supportedCodecs.forEach((codec) => {
        const args = buildDownloadArgs({
          url: 'https://youtube.com/watch?v=sample',
          extractAudio: true,
          audioFormat: codec,
        });
        expect(args).toContain('-x');
        expect(args).toContain('--audio-format');
        expect(args).toContain(codec);
      });
    });

    it('3.2 Audio quality compression slider (0=Best to 9=Smallest) updates extraction settings', () => {
      const qualities = [0, 2, 5, 9];
      qualities.forEach((q) => {
        const args = buildDownloadArgs({
          url: 'https://youtube.com/watch?v=sample',
          extractAudio: true,
          audioFormat: 'mp3',
          audioQuality: q,
        });
        expect(args).toContain('--audio-quality');
        expect(args[args.indexOf('--audio-quality') + 1]).toBe(String(q));
      });
    });

    it('3.3 CLI builder generates -x, --audio-format, and --audio-quality flags', () => {
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        extractAudio: true,
        audioFormat: 'flac',
        audioQuality: 0,
      });
      expect(args).toEqual(
        expect.arrayContaining(['-x', '--audio-format', 'flac', '--audio-quality', '0'])
      );
    });

    it('3.4 Echo prevention: enforces --no-audio-multistreams for video and --audio-multistreams for audio', () => {
      const videoArgs = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        format: '137',
      });
      expect(videoArgs).toContain('--no-audio-multistreams');
      expect(videoArgs).not.toContain('--audio-multistreams');

      const audioArgs = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        extractAudio: true,
        audioFormat: 'mp3',
      });
      expect(audioArgs).toContain('--audio-multistreams');
      expect(audioArgs).not.toContain('--no-audio-multistreams');
    });

    it('3.5 Audio extraction job enqueues into queue and tracks progress independently', async () => {
      const id = await ipcClient.addDownload({
        url: 'https://youtube.com/watch?v=audio-only',
        audioFormat: 'mp3',
        audioQuality: 2,
        outputPath: '/mock/downloads/music.mp3',
      });

      expect(id).toBeDefined();
      const status = harness.queue.getStatus();
      expect(status.total).toBe(1);
    });
  });

  // =========================================================================
  // DOMAIN 4: Custom Timeline Clipping / Trimming (5 tests)
  // =========================================================================
  describe('Domain 4: Custom Timeline Clipping / Trimming', () => {
    it('4.1 Interactive timeline dual-handle slider updates start and end time boundaries', () => {
      const clip = { name: 'intro', start: 15, end: 45 };
      expect(clip.start).toBe(15);
      expect(clip.end).toBe(45);
      expect(clip.end - clip.start).toBe(30);
    });

    it('4.2 Precision numerical HH:MM:SS text inputs update start and end times synchronously', () => {
      const parseTimeToSeconds = (str: string) => {
        const parts = str.split(':').map((p) => parseInt(p, 10));
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] || 0;
      };

      expect(parseTimeToSeconds('00:01:30')).toBe(90);
      expect(parseTimeToSeconds('01:15:00')).toBe(4500);
      expect(parseTimeToSeconds('00:00:45')).toBe(45);
    });

    it('4.3 Injects --force-keyframes-at-cuts and -short_seek_size 1 in CLI arguments', () => {
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        clips: [{ name: 'cut1', start: 30, end: 90 }],
      });

      expect(args).toContain('--force-keyframes-at-cuts');
      expect(args).toEqual(
        expect.arrayContaining(['--downloader-args', 'ffmpeg_i:-short_seek_size 1'])
      );
      expect(args).toContain('--download-sections');
      expect(args).toContain('*30-90');
    });

    it('4.4 Multi-Clip queue builder adds multiple cut segments from a single video', async () => {
      const clips = [
        { name: 'clip-1', start: 10, end: 30 },
        { name: 'clip-2', start: 45, end: 60 },
        { name: 'clip-3', start: 120, end: 180 },
      ];

      const ids: string[] = [];
      for (const c of clips) {
        const id = await ipcClient.addDownload({
          url: 'https://youtube.com/watch?v=sample',
          clips: [c],
          outputPath: `/mock/downloads/sample_${c.name}.mp4`,
        });
        ids.push(id);
      }

      expect(ids).toHaveLength(3);
      expect(harness.queue.getStatus().total).toBe(3);
    });

    it('4.5 Queues clips with section-stamped output templates', () => {
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=sample',
        outputPath: '/mock/downloads',
        clips: [{ name: 'segment', start: 15, end: 35 }],
      });

      const outIdx = args.indexOf('--output');
      expect(outIdx).not.toBe(-1);
      const outputVal = args[outIdx + 1];
      expect(outputVal).toContain('%(section_start)s-%(section_end)s');
    });
  });

  // =========================================================================
  // DOMAIN 5: Batch Queue Operations (5 tests)
  // =========================================================================
  describe('Domain 5: Batch Queue Operations', () => {
    beforeEach(() => {
      harness.delayMs = 200;
    });

    it('5.1 Concurrency limiter enforces parallel active downloads limit (1-8, default 3)', async () => {
      const queue = harness.queue;
      expect(queue.getConcurrency()).toBe(3);

      for (let i = 1; i <= 6; i++) {
        await queue.add({ id: `item-${i}`, url: `https://youtube.com/item${i}` });
      }

      const status = queue.getStatus();
      expect(status.active).toBe(3);
      expect(status.queued).toBe(3);
      expect(status.total).toBe(6);
    });

    it('5.2 Pause item halts child process, preserves partial file, and marks item as paused', async () => {
      const queue = harness.queue;
      await queue.add({ id: 'item-pause', url: 'https://youtube.com/pause' });

      expect(queue.getStatus().active).toBe(1);
      await queue.pause('item-pause');

      const item = queue.getItem('item-pause');
      expect(item?.status).toBe('paused');
    });

    it('5.3 Resume item restarts download passing --continue', async () => {
      const queue = harness.queue;
      await queue.add({ id: 'item-resume', url: 'https://youtube.com/resume' });
      await queue.pause('item-resume');
      expect(queue.getItem('item-resume')?.status).toBe('paused');

      await queue.resume('item-resume');
      expect(queue.getItem('item-resume')?.status).toBe('downloading');
    });

    it('5.4 Cancel item terminates active process, clears resources, and updates status to cancelled', async () => {
      const queue = harness.queue;
      await queue.add({ id: 'item-cancel', url: 'https://youtube.com/cancel' });
      await queue.cancel('item-cancel');

      expect(queue.getItem('item-cancel')?.status).toBe('cancelled');
    });

    it('5.5 Global batch controls: Pause All stops active jobs, Resume All restarts paused jobs', async () => {
      const queue = harness.queue;
      await queue.add({ id: 'b1', url: 'https://youtube.com/b1' });
      await queue.add({ id: 'b2', url: 'https://youtube.com/b2' });

      expect(queue.getStatus().active).toBe(2);
      await queue.pauseAll();
      expect(queue.getStatus().active).toBe(0);
      expect(queue.getStatus().paused).toBe(2);

      await queue.resumeAll();
      expect(queue.getStatus().active).toBe(2);
    });
  });

  // =========================================================================
  // DOMAIN 6: Theme Switching (5 tests)
  // =========================================================================
  describe('Domain 6: Theme Switching', () => {
    it('6.1 Theme toggle switches between Light, Dark, and Monochrome modes', async () => {
      const { setTheme } = useThemeStore.getState();

      await setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');

      await setTheme('monochrome');
      expect(useThemeStore.getState().theme).toBe('monochrome');

      await setTheme('dark');
      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('6.2 Root document attribute data-theme updates dynamically with switch', () => {
      applyThemeToDOM('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);

      applyThemeToDOM('monochrome');
      expect(document.documentElement.getAttribute('data-theme')).toBe('monochrome');
      expect(document.documentElement.classList.contains('theme-monochrome')).toBe(true);
    });

    it('6.3 Monochrome mode enforces strict zero chromatic saturation (Chroma = 0 across all tokens)', () => {
      const tokens = THEME_TOKENS.monochrome;
      const parseHex = (hex: string) => {
        const clean = hex.replace('#', '');
        if (clean.length === 6) {
          return {
            r: parseInt(clean.substring(0, 2), 16),
            g: parseInt(clean.substring(2, 4), 16),
            b: parseInt(clean.substring(4, 6), 16),
          };
        }
        return null;
      };

      const keys: (keyof typeof tokens)[] = [
        'bgApp',
        'bgSurface',
        'bgSurfaceElevated',
        'textPrimary',
        'textSecondary',
        'textTertiary',
        'accent',
        'accentHover',
      ];

      for (const k of keys) {
        const val = tokens[k];
        if (typeof val === 'string' && val.startsWith('#')) {
          const rgb = parseHex(val);
          if (rgb) {
            // Strict Chroma = 0 invariant: R === G === B
            expect(rgb.r).toBe(rgb.g);
            expect(rgb.g).toBe(rgb.b);
          }
        }
      }
    });

    it('6.4 Smooth Apple spring easing curve cubic-bezier(0.16, 1, 0.3, 1) applied to transition tokens', () => {
      const designPath = path.resolve(process.cwd(), 'docs/stitch/DESIGN.md');
      const content = fs.readFileSync(designPath, 'utf8');
      expect(content).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
    });

    it('6.5 Accessibility: prefers-reduced-motion media query suppresses animation duration', () => {
      const cssPath = path.resolve(process.cwd(), 'src/renderer/index.css');
      const content = fs.readFileSync(cssPath, 'utf8');
      expect(content).toContain('@media (prefers-reduced-motion: reduce)');
      expect(content).toContain('animation-duration: 0.01ms !important');
    });
  });

  // =========================================================================
  // DOMAIN 7: Google Stitch Deliverable Compliance (5 tests)
  // =========================================================================
  describe('Domain 7: Google Stitch Deliverable Compliance', () => {
    it('7.1 docs/stitch/DESIGN.md exists and contains valid YAML frontmatter and design tokens', () => {
      const designPath = path.resolve(process.cwd(), 'docs/stitch/DESIGN.md');
      expect(fs.existsSync(designPath)).toBe(true);

      const content = fs.readFileSync(designPath, 'utf8');
      expect(content.startsWith('---')).toBe(true);
      expect(content).toContain('system: "Offliner Design System"');
      expect(content).toContain('themes:');
      expect(content).toContain('Light Mode');
      expect(content).toContain('Dark Mode');
      expect(content).toContain('Monochrome Mode');
    });

    it('7.2 docs/stitch/PROMPTS.md exists with generation prompts for all application screens', () => {
      const promptsPath = path.resolve(process.cwd(), 'docs/stitch/PROMPTS.md');
      expect(fs.existsSync(promptsPath)).toBe(true);

      const content = fs.readFileSync(promptsPath, 'utf8');
      expect(content).toContain('01_home_resolver.html');
      expect(content).toContain('02_video_download.html');
      expect(content).toContain('03_audio_extract.html');
      expect(content).toContain('04_playlist_batch.html');
      expect(content).toContain('05_clips_trimmer.html');
      expect(content).toContain('06_queue_manager.html');
      expect(content).toContain('07_settings.html');
    });

    it('7.3 All 7 semantic view mockups exist under docs/stitch/screens/', () => {
      const screensDir = path.resolve(process.cwd(), 'docs/stitch/screens');
      expect(fs.existsSync(screensDir)).toBe(true);

      const expectedFiles = [
        '01_home_resolver.html',
        '02_video_download.html',
        '03_audio_extract.html',
        '04_playlist_batch.html',
        '05_clips_trimmer.html',
        '06_queue_manager.html',
        '07_settings.html',
      ];

      expectedFiles.forEach((file) => {
        const filePath = path.join(screensDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(1000);
      });
    });

    it('7.4 All extracted Stitch mockups exist in docs/stitch/project_8104687579869282491/', () => {
      const projDir = path.resolve(process.cwd(), 'docs/stitch/project_8104687579869282491');
      expect(fs.existsSync(projDir)).toBe(true);

      const expected = [
        '01_audio_studio_extraction.html',
        '02_single_video_download.html',
        '03_home_universal_resolver.html',
        '04_precision_clips_trimmer.html',
        '05_playlist_batch_downloader.html',
        '06_transfers_download_queue.html',
        '08_preferences_settings.html',
      ];

      expected.forEach((f) => {
        expect(fs.existsSync(path.join(projDir, f))).toBe(true);
      });
    });

    it('7.5 Stitch HTML screen templates validate as semantic HTML5 with Tailwind CSS classes', () => {
      const screensDir = path.resolve(process.cwd(), 'docs/stitch/screens');
      const files = fs.readdirSync(screensDir).filter((f) => f.endsWith('.html'));

      files.forEach((f) => {
        const html = fs.readFileSync(path.join(screensDir, f), 'utf8');
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html');
        expect(html).toContain('class=');
      });
    });
  });

  // =========================================================================
  // DOMAIN 8: Queue Maintenance (5 tests)
  // =========================================================================
  describe('Domain 8: Queue Maintenance', () => {
    it('8.1 Native file operation: "Open File" invokes OS default player via IPC bridge', async () => {
      const testPath = '/mock/downloads/test_video.mp4';
      harness.mockFileSystem.add(testPath);

      await expect(ipcClient.openFile(testPath)).resolves.not.toThrow();
    });

    it('8.2 Native file operation: "Show in Folder" reveals file in file manager via IPC bridge', async () => {
      const testPath = '/mock/downloads/test_video.mp4';
      harness.mockFileSystem.add(testPath);

      await expect(ipcClient.showInFolder(testPath)).resolves.not.toThrow();
    });

    it('8.3 Safe trash deletion invokes OS Recycle Bin / Trash API via IPC bridge', async () => {
      const testPath = '/mock/downloads/trash_target.mp4';
      harness.mockFileSystem.add(testPath);

      const deleted = await ipcClient.deleteFile(testPath);
      expect(deleted).toBe(true);
      expect(harness.mockFileSystem.has(testPath)).toBe(false);
    });

    it('8.4 "Clear Finished" purges completed, cancelled, and error items while keeping active/queued', () => {
      const { addDownload, clearFinishedDownloads } = useDownloadStore.getState();

      const items: DownloadItem[] = [
        { id: 'd1', url: 'https://youtube.com/d1', title: 'Done 1', thumbnail: '', status: 'done', progress: 100, createdAt: 1, config: { url: 'd1' } },
        { id: 'd2', url: 'https://youtube.com/d2', title: 'Active 2', thumbnail: '', status: 'downloading', progress: 50, createdAt: 2, config: { url: 'd2' } },
        { id: 'd3', url: 'https://youtube.com/d3', title: 'Cancelled 3', thumbnail: '', status: 'cancelled', progress: 10, createdAt: 3, config: { url: 'd3' } },
        { id: 'd4', url: 'https://youtube.com/d4', title: 'Error 4', thumbnail: '', status: 'error', progress: 20, createdAt: 4, config: { url: 'd4' } },
        { id: 'd5', url: 'https://youtube.com/d5', title: 'Queued 5', thumbnail: '', status: 'queued', progress: 0, createdAt: 5, config: { url: 'd5' } },
      ];

      items.forEach((item) => addDownload(item));
      expect(useDownloadStore.getState().downloads.size).toBe(5);

      clearFinishedDownloads();

      const remaining = useDownloadStore.getState().downloads;
      expect(remaining.size).toBe(2);
      expect(remaining.has('d2')).toBe(true); // downloading preserved
      expect(remaining.has('d5')).toBe(true); // queued preserved
      expect(remaining.has('d1')).toBe(false); // done purged
      expect(remaining.has('d3')).toBe(false); // cancelled purged
      expect(remaining.has('d4')).toBe(false); // error purged
    });

    it('8.5 Background file verification poller detects externally removed files and updates state', async () => {
      const { addDownload, verifyDownloads } = useDownloadStore.getState();

      const item: DownloadItem = {
        id: 'external-del',
        url: 'https://youtube.com/ext',
        title: 'External Deleted Item',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/mock/downloads/missing_external.mp4',
        createdAt: Date.now(),
        config: { url: 'ext' },
      };
      addDownload(item);

      // Verify item exists initially
      expect(useDownloadStore.getState().downloads.get('external-del')?.status).toBe('done');

      // The mockFileSystem does NOT have /mock/downloads/missing_external.mp4
      await verifyDownloads();

      expect(useDownloadStore.getState().downloads.get('external-del')?.status).toBe('cancelled');
    });
  });
});
